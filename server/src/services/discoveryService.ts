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
import { icpService } from './icpService.js';
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

  getConnectorCapabilities(): Array<{
    id: string;
    name: string;
    providerType: 'live_api' | 'first_party_crm' | 'signal_enrichment' | 'demo_sandbox';
    capabilities: string[];
    isConfigured: boolean;
    requiredCredentials: string[];
    healthStatus: 'healthy' | 'degraded' | 'unreachable';
    costModel: { perRecord: number; currency: string };
    knownLimitations: string;
    roleDescription: string;
  }> {
    const hunter = providerRegistry.get('hunter');
    const isHunterConfigured = hunter ? hunter.isConfigured() : false;

    return [
      {
        id: 'hunter',
        name: 'Hunter.io (Domain Search API v2)',
        providerType: 'live_api',
        capabilities: ['contact_discovery', 'domain_search', 'email_verification', 'source_citations'],
        isConfigured: isHunterConfigured,
        requiredCredentials: ['HUNTER_API_KEY'],
        healthStatus: isHunterConfigured ? 'healthy' : 'degraded',
        costModel: { perRecord: 0.04, currency: 'USD' },
        knownLimitations: 'Requires corporate domain input. Does not perform broad market company discovery.',
        roleDescription: 'Retrieves verified decision-maker emails, departments, and public source citations for a known domain.',
      },
      {
        id: 'first_party_crm',
        name: 'First-Party CRM Repository (SQLite / HubSpot)',
        providerType: 'first_party_crm',
        capabilities: ['first_party_records', 'company_discovery', 'account_enrichment'],
        isConfigured: true,
        requiredCredentials: [],
        healthStatus: 'healthy',
        costModel: { perRecord: 0.00, currency: 'USD' },
        knownLimitations: 'Searches only existing local leads and opportunities previously synced.',
        roleDescription: 'Identifies expansion opportunities and avoids contacting existing pipeline accounts.',
      },
      {
        id: 'github_jobs',
        name: 'Job Board & Hiring Velocity Signals',
        providerType: 'signal_enrichment',
        capabilities: ['hiring_signals', 'technology_signals'],
        isConfigured: true,
        requiredCredentials: [],
        healthStatus: 'healthy',
        costModel: { perRecord: 0.00, currency: 'USD' },
        knownLimitations: 'Provides intent signals only; does not provide verified personal contact emails.',
        roleDescription: 'Monitors hiring surges in engineering, sales operations, and executive leadership.',
      },
      {
        id: 'builtwith_signals',
        name: 'Technographic Stack Detection',
        providerType: 'signal_enrichment',
        capabilities: ['technology_signals'],
        isConfigured: true,
        requiredCredentials: [],
        healthStatus: 'healthy',
        costModel: { perRecord: 0.00, currency: 'USD' },
        knownLimitations: 'Signals require independent domain verification before contact discovery.',
        roleDescription: 'Detects presence of Salesforce, HubSpot, Snowflake, Stripe, and AWS stacks.',
      },
      {
        id: 'mock',
        name: 'LeadForge Demo Sandbox',
        providerType: 'demo_sandbox',
        capabilities: ['company_discovery', 'contact_discovery', 'intent_signals', 'offline_evaluation'],
        isConfigured: true,
        requiredCredentials: [],
        healthStatus: 'healthy',
        costModel: { perRecord: 0.00, currency: 'USD' },
        knownLimitations: 'Curated deterministic seed graph for safe training and product evaluation. Not real live leads.',
        roleDescription: 'Deterministic sandbox allowing feature exploration without consuming live API credits.',
      },
    ];
  },

  runDryRun(input: {
    domain: string;
    limit?: number;
    targetRoles?: string[];
  }): {
    isDryRun: true;
    domain: string;
    targetIcp: { id: string; name: string };
    plannedOperations: Array<{ stage: string; action: string; provider: string; estimatedCost: number; status: string }>;
    projectedYield: number;
    projectedCost: number;
    filteringFunnel: Array<{ stage: string; initial: number; surviving: number; dropReason?: string }>;
    projectedCandidates: Array<{
      fullName: string;
      title: string;
      email: string;
      confidence: number;
      estimatedScore: number;
      tier: string;
      signals: string[];
    }>;
    notes: string;
  } {
    if (!input.domain || !input.domain.trim()) {
      throw new Error('A valid company domain is required for Dry-Run Simulation.');
    }

    const domainNorm = input.domain
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0];

    const limit = Math.max(1, Math.min(input.limit || 10, 50));
    const activeIcp = icpService.getActive() || icpService.getAll()[0];
    const icpName = activeIcp ? activeIcp.name : 'Standard B2B SaaS ICP';

    const plannedOperations = [
      {
        stage: 'Stage 1 — Domain Validation',
        action: `Resolve DNS and corporate MX records for ${domainNorm}`,
        provider: 'Core Resolver',
        estimatedCost: 0.0,
        status: 'simulated_pass',
      },
      {
        stage: 'Stage 2 — Technographic Signal Evaluation',
        action: `Inspect detected tech stack against target ICP criteria`,
        provider: 'builtwith_signals',
        estimatedCost: 0.0,
        status: 'simulated_pass',
      },
      {
        stage: 'Stage 3 — Hiring & Intent Verification',
        action: `Check hiring trends for ${domainNorm} (RevOps, Executive SDR roles)`,
        provider: 'github_jobs',
        estimatedCost: 0.0,
        status: 'simulated_pass',
      },
      {
        stage: 'Stage 4 — Contact Discovery & Verification',
        action: `Plan Hunter.io personal search for roles: ${(input.targetRoles || ['Executive', 'Sales', 'Growth']).join(', ')}`,
        provider: 'hunter',
        estimatedCost: +(limit * 0.04).toFixed(2),
        status: 'simulated_planned',
      },
      {
        stage: 'Stage 5 — Progressive Deterministic Scoring',
        action: `Score prospective candidate profile against active ICP weights`,
        provider: 'LeadForge Scoring Engine',
        estimatedCost: 0.0,
        status: 'simulated_pass',
      },
    ];

    const filteringFunnel = [
      { stage: '1. Raw Discovery Universe', initial: limit, surviving: limit },
      { stage: '2. Identity Resolution & Dedup', initial: limit, surviving: Math.max(1, Math.floor(limit * 0.9)), dropReason: 'Existing CRM or duplicate contact' },
      { stage: '3. Firmographic Fit Check', initial: Math.max(1, Math.floor(limit * 0.9)), surviving: Math.max(1, Math.floor(limit * 0.8)), dropReason: 'Outside employee headcount tier' },
      { stage: '4. Title Authority Screening', initial: Math.max(1, Math.floor(limit * 0.8)), surviving: Math.max(1, Math.floor(limit * 0.7)), dropReason: 'Non-decision maker title' },
      { stage: '5. Deliverability Confidence', initial: Math.max(1, Math.floor(limit * 0.7)), surviving: Math.max(1, Math.floor(limit * 0.65)), dropReason: 'Risky or disposable mailbox' },
    ];

    const projectedCandidates = [
      {
        fullName: 'Alex Vance',
        title: 'VP of Revenue Operations',
        email: `alex.vance@${domainNorm}`,
        confidence: 94,
        estimatedScore: 92,
        tier: 'HIGH',
        signals: ['Hiring 4 SDRs', 'Tech Stack: Salesforce, Snowflake'],
      },
      {
        fullName: 'Morgan Sterling',
        title: 'Head of Sales Development',
        email: `morgan.s@${domainNorm}`,
        confidence: 88,
        estimatedScore: 86,
        tier: 'HIGH',
        signals: ['Tech Stack: Outreach, Apollo'],
      },
      {
        fullName: 'Jordan Taylor',
        title: 'Director of Growth Marketing',
        email: `jordan.taylor@${domainNorm}`,
        confidence: 82,
        estimatedScore: 78,
        tier: 'MEDIUM',
        signals: ['Tech Stack: HubSpot'],
      },
    ].slice(0, limit);

    return {
      isDryRun: true,
      domain: domainNorm,
      targetIcp: { id: activeIcp?.id || 'icp-default', name: icpName },
      plannedOperations,
      projectedYield: projectedCandidates.length,
      projectedCost: +(limit * 0.04).toFixed(2),
      filteringFunnel,
      projectedCandidates,
      notes: 'Dry-Run Simulation executed in an isolated memory sandbox. Zero external API credits consumed; zero records created in production database.',
    };
  },

  cleanupDemoData(): {
    cleanedCandidates: number;
    cleanedJobs: number;
    cleanedLeads: number;
    cleanedOpportunities: number;
  } {
    const db = getDb();

    // Perform inside transaction for safety
    const transaction = db.transaction(() => {
      // 1. Delete candidates belonging to mock jobs or flagged as is_mock
      const candRes = db.prepare(`
        DELETE FROM discovered_candidates
        WHERE job_id IN (SELECT id FROM discovery_jobs WHERE mode = 'mock')
           OR is_mock = 1
      `).run();

      // 2. Delete mock discovery jobs
      const jobsRes = db.prepare(`
        DELETE FROM discovery_jobs WHERE mode = 'mock'
      `).run();

      // 3. Delete mock opportunities associated with mock leads
      const oppsRes = db.prepare(`
        DELETE FROM opportunities
        WHERE lead_id IN (SELECT id FROM leads WHERE is_mock = 1)
      `).run();

      // 4. Delete mock leads
      const leadsRes = db.prepare(`
        DELETE FROM leads WHERE is_mock = 1
      `).run();

      return {
        cleanedCandidates: candRes.changes,
        cleanedJobs: jobsRes.changes,
        cleanedLeads: leadsRes.changes,
        cleanedOpportunities: oppsRes.changes,
      };
    });

    const counts = transaction();

    activityService.log(
      'discovery',
      'Demo Sandbox Records Purged',
      `Purged ${counts.cleanedCandidates} demo candidates, ${counts.cleanedJobs} demo jobs, and ${counts.cleanedLeads} demo leads. Production data remains untouched.`,
      `${counts.cleanedCandidates} Purged`
    );

    return counts;
  },
};

