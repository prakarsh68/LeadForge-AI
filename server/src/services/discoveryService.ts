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
import { activityService } from './activityService.js';
import { dataQualityService } from './dataQualityService.js';
import { discoveryQueueService } from './discoveryQueueService.js';

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

  getAllJobs(limit: number = 20): DiscoveryJobDTO[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM discovery_jobs ORDER BY created_at DESC LIMIT ?').all(Math.min(limit, 100)) as DiscoveryJobEntity[];
    return rows.map(discoveryJobEntityToDto);
  },

  getAllCandidates(filters: { status?: string; limit?: number } = {}): DiscoveredCandidateDTO[] {
    const db = getDb();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(filters.limit || 50, 200);

    const rows = db.prepare(`
      SELECT * FROM discovered_candidates
      ${whereClause}
      ORDER BY icp_score_preview DESC, created_at DESC
      LIMIT ?
    `).all(...params, limit) as DiscoveredCandidateEntity[];

    return rows.map(discoveredCandidateEntityToDto);
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

  async startJob(
    input: StartDiscoveryJobInput,
    options?: { async?: boolean }
  ): Promise<{
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

    // Durable insert: job is committed as 'queued' BEFORE execution begins
    db.prepare(`
      INSERT INTO discovery_jobs (
        id, provider, mode, status, query_params,
        total_found, candidates_found, candidates_processed, candidates_ingested, candidates_skipped, candidates_failed,
        attempt_count, max_retries, retry_count, created_at, updated_at
      ) VALUES (?, ?, ?, 'queued', ?, 0, 0, 0, 0, 0, 0, 0, 3, 0, datetime('now'), datetime('now'))
    `).run(
      jobId,
      provider.id,
      provider.mode,
      JSON.stringify({ domain: domainNorm, limit, targetRoles: input.targetRoles || [] })
    );

    if (options?.async) {
      // Dispatched to background execution
      void discoveryQueueService.trigger();
      const queuedJob = this.getJob(jobId)!;
      return {
        job: queuedJob,
        candidates: [],
      };
    }

    // Process job through the durable queue runner
    const completedJob = await discoveryQueueService.processJob(jobId);
    const candidates = this.getCandidates(jobId);

    return {
      job: completedJob,
      candidates,
    };
  },

  cancelJob(jobId: string): { success: boolean; message: string; job?: DiscoveryJobDTO } {
    return discoveryQueueService.cancelJob(jobId);
  },

  retryJob(jobId: string): { success: boolean; message: string; job?: DiscoveryJobDTO } {
    return discoveryQueueService.retryJob(jobId);
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

    // Identity revalidation at ingestion time: prevent duplicate contacts if added after discovery
    if (candidate.email) {
      const normEmail = dataQualityService.normalizeEmail(candidate.email);
      if (normEmail) {
        const existingLead = db
          .prepare('SELECT id, name, company FROM leads WHERE LOWER(TRIM(email)) = ?')
          .get(normEmail) as { id: string; name: string; company: string } | undefined;

        if (existingLead) {
          db.prepare(`
            UPDATE discovered_candidates
            SET dedup_status = 'existing_lead',
                existing_lead_id = ?
            WHERE id = ?
          `).run(existingLead.id, candidateId);

          throw new Error(
            `Contact email "${candidate.email}" already exists in CRM (linked to lead "${existingLead.id}"). Ingestion skipped.`
          );
        }
      }
    }

    const normDomain = dataQualityService.normalizeDomain(candidate.companyDomain);
    const normCompany = dataQualityService.normalizeCompany(candidate.companyName);
    const normTitle = dataQualityService.normalizeTitle(candidate.title);
    const normEmail = dataQualityService.normalizeEmail(candidate.email);

    const ingestTx = db.transaction(() => {
      // 1. Create official lead record with clean normalized values
      const createdLead = leadService.create({
        name: candidate.contactName.trim(),
        title: normTitle,
        company: normCompany,
        companyDomain: normDomain,
        email: normEmail || `contact@${normDomain}`,
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
        notes: `Discovered from ${normDomain} on ${new Date().toISOString().slice(0, 10)}. Email verification: ${candidate.emailVerification}.`,
      });

      // 2. Attach provenance, verification status, and enriched timestamp to the new lead
      const primarySourceUrl = candidate.sourceUrls[0] || null;
      db.prepare(`
        UPDATE leads
        SET source_provider = ?,
            source_url = ?,
            email_verification_status = ?,
            enrichment_provenance = ?,
            is_mock = ?,
            enriched_at = datetime('now')
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

      // 5. Increment job ingested counter
      if (candidate.jobId) {
        db.prepare(`
          UPDATE discovery_jobs
          SET candidates_ingested = candidates_ingested + 1,
              updated_at = datetime('now')
          WHERE id = ?
        `).run(candidate.jobId);
      }

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

  ingestBatch(candidateIds: string[]): {
    ingested: Array<{ lead: LeadDTO; candidateId: string }>;
    skipped: Array<{ candidateId: string; reason: string }>;
    failed: Array<{ candidateId: string; error: string }>;
    counts: { total: number; ingested: number; skipped: number; failed: number };
  } {
    const results = {
      ingested: [] as Array<{ lead: LeadDTO; candidateId: string }>,
      skipped: [] as Array<{ candidateId: string; reason: string }>,
      failed: [] as Array<{ candidateId: string; error: string }>,
      counts: {
        total: Array.isArray(candidateIds) ? candidateIds.length : 0,
        ingested: 0,
        skipped: 0,
        failed: 0,
      },
    };

    if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
      return results;
    }

    for (const id of candidateIds) {
      try {
        const candidate = this.getCandidateById(id);
        if (!candidate) {
          results.failed.push({ candidateId: id, error: `Candidate not found with id ${id}` });
          continue;
        }

        if (candidate.status === 'ingested') {
          results.skipped.push({ candidateId: id, reason: 'Already ingested into CRM' });
          continue;
        }

        if (candidate.dedupStatus === 'existing_lead') {
          results.skipped.push({ candidateId: id, reason: 'Contact email already exists in CRM' });
          continue;
        }

        if (candidate.dedupStatus === 'duplicate_in_job') {
          results.skipped.push({ candidateId: id, reason: 'Duplicate contact within search run' });
          continue;
        }

        const { lead } = this.ingestCandidate(id);
        results.ingested.push({ lead, candidateId: id });
      } catch (err: any) {
        if (err.message && (err.message.includes('already exists in CRM') || err.message.includes('already been ingested'))) {
          results.skipped.push({ candidateId: id, reason: err.message });
        } else {
          results.failed.push({ candidateId: id, error: err.message || 'Unknown ingestion error' });
        }
      }
    }

    results.counts.ingested = results.ingested.length;
    results.counts.skipped = results.skipped.length;
    results.counts.failed = results.failed.length;

    if (results.counts.ingested > 0) {
      activityService.log(
        'discovery',
        'Bulk Candidates Ingested',
        `Successfully ingested ${results.counts.ingested} candidates into sales pipeline (${results.counts.skipped} skipped, ${results.counts.failed} failed)`,
        `${results.counts.ingested} Ingested`
      );
    }

    return results;
  },
};
