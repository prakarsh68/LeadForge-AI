import { getDb } from '../db/database.js';
import type {
  DiscoveryJobEntity,
  DiscoveryJobDTO,
  DiscoveredCandidateEntity,
  DiscoveredCandidateDTO,
  LeadDTO,
  OpportunityDTO,
  DiscoveryProviderStatusDTO,
  LeadEntity,
} from '../types/index.js';
import {
  discoveryJobEntityToDto,
  discoveredCandidateEntityToDto,
  opportunityEntityToDto,
} from '../utils/serializers.js';
import { providerRegistry } from './discovery/providerRegistry.js';
import { leadService } from './leadService.js';
import { leadScoringService } from './leadScoringService.js';
import { icpService } from './icpService.js';
import { activityService } from './activityService.js';

export interface StartDiscoveryJobInput {
  provider?: string;
  domain: string;
  limit?: number;
  targetRoles?: string[];
}

export const discoveryService = {
  listProviders(): DiscoveryProviderStatusDTO[] {
    return providerRegistry.listStatuses();
  },

  getJob(id: string): DiscoveryJobDTO | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM discovery_jobs WHERE id = ?').get(id) as DiscoveryJobEntity | undefined;
    return row ? discoveryJobEntityToDto(row) : null;
  },

  getCandidates(jobId: string, filters: { status?: string } = {}): DiscoveredCandidateDTO[] {
    const db = getDb();
    const conditions = ['job_id = ?'];
    const params: any[] = [jobId];

    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }

    const rows = db.prepare(`
      SELECT * FROM discovered_candidates
      WHERE ${conditions.join(' AND ')}
      ORDER BY icp_score_preview DESC, created_at ASC
    `).all(...params) as DiscoveredCandidateEntity[];

    return rows.map(discoveredCandidateEntityToDto);
  },

  getCandidateById(id: string): DiscoveredCandidateDTO | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM discovered_candidates WHERE id = ?').get(id) as DiscoveredCandidateEntity | undefined;
    return row ? discoveredCandidateEntityToDto(row) : null;
  },

  async startJob(input: StartDiscoveryJobInput): Promise<{
    job: DiscoveryJobDTO;
    candidates: DiscoveredCandidateDTO[];
  }> {
    const db = getDb();

    if (!input.domain || !input.domain.trim()) {
      throw new Error('Company domain is required for discovery.');
    }

    const domainNorm = input.domain
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0];

    // Resolve provider: default to 'hunter' if configured, otherwise 'mock' (demo mode)
    let requestedProviderId = (input.provider || '').toLowerCase().trim();
    if (!requestedProviderId) {
      const hunter = providerRegistry.get('hunter');
      requestedProviderId = hunter && hunter.isConfigured() ? 'hunter' : 'mock';
    }

    const provider = providerRegistry.get(requestedProviderId);
    if (!provider) {
      throw new Error(`Unknown discovery provider: "${requestedProviderId}". Available: hunter, mock.`);
    }

    // Explicit error if real provider requested but not configured (prevent silent fake data)
    if (provider.mode === 'real' && !provider.isConfigured()) {
      throw new Error(
        `Real discovery via "${provider.displayName}" is unavailable because HUNTER_API_KEY is not configured in the server environment. Please set HUNTER_API_KEY or select Demo Mode ("mock").`
      );
    }

    const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const limit = Math.max(1, Math.min(input.limit || 10, 50));

    // Record job as running
    db.prepare(`
      INSERT INTO discovery_jobs (id, provider, mode, status, query_params, total_found, created_at)
      VALUES (?, ?, ?, 'running', ?, 0, datetime('now'))
    `).run(
      jobId,
      provider.id,
      provider.mode,
      JSON.stringify({ domain: domainNorm, limit, targetRoles: input.targetRoles || [] })
    );

    let rawCandidates: any[] = [];
    try {
      rawCandidates = await provider.searchDomain({
        domain: domainNorm,
        limit,
        targetRoles: input.targetRoles,
      });
    } catch (err: any) {
      db.prepare(`
        UPDATE discovery_jobs
        SET status = 'failed',
            error_message = ?,
            completed_at = datetime('now')
        WHERE id = ?
      `).run(err.message || 'Discovery provider execution failed', jobId);
      throw err;
    }

    // Process & stage candidates in a safe transaction
    const processTx = db.transaction(() => {
      // 1. Fetch active ICP profile for honest scoring preview
      const activeIcp = icpService.getActive();

      // 2. Fetch existing leads for safe identity matching
      const existingLeads = db.prepare('SELECT id, email, company_domain FROM leads').all() as Array<{
        id: string;
        email: string;
        company_domain: string;
      }>;

      const emailToLeadId = new Map<string, string>();
      const domainToLeadId = new Map<string, string>();

      for (const el of existingLeads) {
        if (el.email) {
          emailToLeadId.set(el.email.toLowerCase().trim(), el.id);
        }
        if (el.company_domain) {
          domainToLeadId.set(el.company_domain.toLowerCase().trim(), el.id);
        }
      }

      const seenEmailsInJob = new Set<string>();

      const insertCandidateStmt = db.prepare(`
        INSERT INTO discovered_candidates (
          id, job_id, provider, mode, external_id, company_name, company_domain,
          contact_name, title, email, email_verification, confidence_score, linkedin,
          location, industry, company_size, source_urls, provenance_metadata,
          icp_score_preview, icp_tier_preview, dedup_status, existing_lead_id, status,
          is_mock, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'staged', ?, datetime('now'))
      `);

      for (let idx = 0; idx < rawCandidates.length; idx++) {
        const c = rawCandidates[idx];
        const candId = `cand-${jobId}-${idx + 1}`;
        const candEmail = (c.email || '').toLowerCase().trim();
        const candDomain = (c.companyDomain || domainNorm).toLowerCase().trim();

        // Safe identity & deduplication logic
        let dedupStatus: 'new' | 'existing_lead' | 'same_company_existing' | 'duplicate_in_job' = 'new';
        let existingLeadId: string | null = null;

        if (candEmail && emailToLeadId.has(candEmail)) {
          // Exact contact email already present in CRM
          dedupStatus = 'existing_lead';
          existingLeadId = emailToLeadId.get(candEmail) || null;
        } else if (candEmail && seenEmailsInJob.has(candEmail)) {
          // Duplicate contact within this single search run
          dedupStatus = 'duplicate_in_job';
        } else if (domainToLeadId.has(candDomain)) {
          // Company account exists in CRM, but this contact is new
          dedupStatus = 'same_company_existing';
          existingLeadId = domainToLeadId.get(candDomain) || null;
        }

        if (candEmail) {
          seenEmailsInJob.add(candEmail);
        }

        // Preview qualification score using Phase 3A deterministic engine
        let scorePreview: number | null = null;
        let tierPreview: any = null;

        if (activeIcp) {
          const previewLead: any = {
            id: c.externalId || candId,
            name: c.fullName,
            title: c.title,
            company: c.companyName,
            companyDomain: candDomain,
            industry: c.industry || '',
            companySize: c.companySize || '',
            triggers: [],
            notes: '',
          };
          const qual = leadScoringService.evaluateLead(previewLead, activeIcp);
          scorePreview = qual.overallScore;
          tierPreview = qual.tier;
        }

        insertCandidateStmt.run(
          candId,
          jobId,
          provider.id,
          provider.mode,
          c.externalId || null,
          c.companyName,
          candDomain,
          c.fullName,
          c.title,
          c.email || null,
          c.emailVerification || 'unverified',
          c.confidence ?? null,
          c.linkedinUrl || null,
          c.location || null,
          c.industry || null,
          c.companySize || null,
          JSON.stringify(c.sourceUrls || []),
          JSON.stringify(c.fieldProvenance || {}),
          scorePreview,
          tierPreview,
          dedupStatus,
          existingLeadId,
          c.isMock ? 1 : 0
        );
      }

      // 3. Mark job completed
      db.prepare(`
        UPDATE discovery_jobs
        SET status = 'completed',
            total_found = ?,
            completed_at = datetime('now')
        WHERE id = ?
      `).run(rawCandidates.length, jobId);
    });

    processTx();

    // Log discovery activity
    activityService.log(
      'discovery',
      `Outbound Discovery (${provider.mode.toUpperCase()})`,
      `Found ${rawCandidates.length} candidate contacts at ${domainNorm} via ${provider.displayName}`,
      `${rawCandidates.length} Found`
    );

    const completedJob = this.getJob(jobId);
    const candidates = this.getCandidates(jobId);

    return {
      job: completedJob!,
      candidates,
    };
  },

  ingestCandidate(candidateId: string): {
    lead: LeadDTO;
    opportunity: OpportunityDTO;
    candidate: DiscoveredCandidateDTO;
  } {
    const db = getDb();
    const candidate = this.getCandidateById(candidateId);
    if (!candidate) {
      throw new Error(`Discovered candidate not found: ${candidateId}`);
    }

    if (candidate.status === 'ingested') {
      throw new Error('This candidate has already been ingested into the CRM.');
    }

    const ingestTx = db.transaction(() => {
      // 1. Create official lead record
      const createdLead = leadService.create({
        name: candidate.contactName,
        title: candidate.title,
        company: candidate.companyName,
        companyDomain: candidate.companyDomain,
        email: candidate.email || `contact@${candidate.companyDomain}`,
        linkedin: candidate.linkedin || undefined,
        location: candidate.location || undefined,
        industry: candidate.industry || 'Enterprise Software & Cloud',
        companySize: candidate.companySize || '100 - 250',
        dealValue: 50000,
        status: 'New',
        triggers: [
          `Discovered via ${candidate.provider.toUpperCase()} (${candidate.mode} mode)`,
          candidate.sourceUrls[0] ? `Source citation: ${candidate.sourceUrls[0]}` : 'Domain-level public directory',
        ],
        notes: `Discovered from ${candidate.companyDomain} on ${new Date().toISOString().slice(0, 10)}. Email verification: ${candidate.emailVerification}.`,
      });

      // 2. Attach provenance and source attribution to the new lead
      const primarySourceUrl = candidate.sourceUrls[0] || null;
      db.prepare(`
        UPDATE leads
        SET source_provider = ?,
            source_url = ?,
            email_verification_status = ?,
            enrichment_provenance = ?,
            is_mock = ?
        WHERE id = ?
      `).run(
        candidate.provider,
        primarySourceUrl,
        candidate.emailVerification,
        JSON.stringify(candidate.provenanceMetadata),
        candidate.isMock ? 1 : 0,
        createdLead.id
      );

      // 3. Immediately run deterministic ICP qualification
      leadService.qualify(createdLead.id);

      // 4. Update staged candidate status
      db.prepare(`
        UPDATE discovered_candidates
        SET status = 'ingested',
            ingested_lead_id = ?
        WHERE id = ?
      `).run(createdLead.id, candidateId);

      return {
        leadId: createdLead.id,
      };
    });

    const { leadId } = ingestTx();

    const freshLead = leadService.getById(leadId)!;
    const oppRow = db.prepare('SELECT * FROM opportunities WHERE lead_id = ?').get(leadId) as any;
    const leadRow = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId) as LeadEntity;
    const freshOpp = opportunityEntityToDto(oppRow, leadRow);
    const updatedCandidate = this.getCandidateById(candidateId)!;

    return {
      lead: freshLead,
      opportunity: freshOpp,
      candidate: updatedCandidate,
    };
  },
};
