import { getDb } from '../db/database.js';
import type {
  DiscoveryJobEntity,
  DiscoveryJobDTO,
  DiscoveryJobStatus,
  LeadScoreTier,
} from '../types/index.js';
import {
  discoveryJobEntityToDto,
} from '../utils/serializers.js';
import { providerRegistry } from './discovery/providerRegistry.js';
import {
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderTimeoutError,
} from './discovery/types.js';
import { leadScoringService } from './leadScoringService.js';
import { icpService } from './icpService.js';
import { activityService } from './activityService.js';
import { dataQualityService } from './dataQualityService.js';

export type ErrorCategory =
  | 'network_timeout'
  | 'rate_limit'
  | 'auth_failure'
  | 'invalid_config'
  | 'internal'
  | 'lease_expired'
  | 'recovered_after_crash';

export interface ClassifiedError {
  category: ErrorCategory;
  message: string;
  retryable: boolean;
  retryAfterSeconds?: number;
}

const VALID_TRANSITIONS: Record<DiscoveryJobStatus, DiscoveryJobStatus[]> = {
  queued: ['running', 'cancelled'],
  pending: ['running', 'cancelled'],
  running: ['completed', 'partially_completed', 'failed', 'cancelled'],
  failed: ['queued'],
  cancelled: ['queued'],
  partially_completed: ['queued'],
  completed: [],
};

export class DiscoveryQueueService {
  private workerId: string;
  private isRunning: boolean = false;
  private isShuttingDown: boolean = false;
  private timer: NodeJS.Timeout | null = null;
  private isProcessingTick: boolean = false;

  constructor() {
    this.workerId = `worker-${process.pid}-${Date.now().toString(36)}`;
  }

  getWorkerId(): string {
    return this.workerId;
  }

  /**
   * Validate state machine transitions.
   */
  isValidTransition(from: DiscoveryJobStatus, to: DiscoveryJobStatus): boolean {
    const allowed = VALID_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }

  /**
   * Classify and sanitize errors safely without leaking credentials.
   */
  classifyError(err: any): ClassifiedError {
    const rawMsg = err?.message || 'Unknown error occurred during discovery';
    // Sanitize any API key, auth header, or token from error message
    const sanitized = rawMsg
      .replace(/(api[-_]?key\s*[:=]\s*)['"]?[^'"\s]+['"]?/gi, '$1[REDACTED]')
      .replace(/(bearer\s+)[a-zA-Z0-9_\-.]+/gi, '$1[REDACTED]')
      .replace(/(hunter_api_key\s*[:=]\s*)['"]?[^'"\s]+['"]?/gi, '$1[REDACTED]');

    if (err instanceof ProviderAuthError || /unauthorized|invalid api key|forbidden|401|403/i.test(rawMsg)) {
      return { category: 'auth_failure', message: sanitized, retryable: false };
    }
    if (err instanceof ProviderRateLimitError || /rate limit|too many requests|429/i.test(rawMsg)) {
      const retryAfter = (err as any).retryAfterSeconds || 60;
      return { category: 'rate_limit', message: sanitized, retryable: true, retryAfterSeconds: retryAfter };
    }
    if (err instanceof ProviderTimeoutError || /timeout|econnreset|econnrefused|enotfound|etimedout/i.test(rawMsg)) {
      return { category: 'network_timeout', message: sanitized, retryable: true };
    }
    if (/domain is required|invalid domain|unknown discovery provider/i.test(rawMsg)) {
      return { category: 'invalid_config', message: sanitized, retryable: false };
    }
    return { category: 'internal', message: sanitized, retryable: true };
  }

  /**
   * Boot-time recovery: claims abandoned jobs from previous crashed process.
   */
  recoverAbandonedJobs(): { recoveredCount: number; failedCount: number } {
    const db = getDb();
    let recoveredCount = 0;
    let failedCount = 0;

    try {
      const abandoned = db.prepare(`
        SELECT * FROM discovery_jobs
        WHERE status = 'running'
          AND (lease_expires_at IS NULL OR lease_expires_at < datetime('now') OR claimed_by != ?)
      `).all(this.workerId) as DiscoveryJobEntity[];

      for (const job of abandoned) {
        if (job.attempt_count < job.max_retries) {
          db.prepare(`
            UPDATE discovery_jobs
            SET status = 'queued',
                claimed_by = NULL,
                claimed_at = NULL,
                lease_expires_at = NULL,
                last_error_category = 'recovered_after_crash',
                updated_at = datetime('now')
            WHERE id = ?
          `).run(job.id);
          recoveredCount++;
        } else {
          db.prepare(`
            UPDATE discovery_jobs
            SET status = 'failed',
                claimed_by = NULL,
                claimed_at = NULL,
                lease_expires_at = NULL,
                last_error_category = 'lease_expired',
                error_message = 'Job execution lease expired after server recovery (max retries reached)',
                completed_at = datetime('now'),
                updated_at = datetime('now')
            WHERE id = ?
          `).run(job.id);
          failedCount++;
        }
      }
    } catch (err) {
      console.error('[DiscoveryQueue] Error during restart recovery:', err);
    }

    return { recoveredCount, failedCount };
  }

  /**
   * Atomic lease-based job claim.
   */
  claimJob(jobId: string): boolean {
    const db = getDb();
    const result = db.prepare(`
      UPDATE discovery_jobs
      SET status = 'running',
          claimed_by = ?,
          claimed_at = datetime('now'),
          lease_expires_at = datetime('now', '+5 minutes'),
          started_at = COALESCE(started_at, datetime('now')),
          updated_at = datetime('now'),
          attempt_count = attempt_count + 1
      WHERE id = ? AND (
        status = 'queued' OR
        status = 'pending' OR
        (status = 'running' AND (lease_expires_at < datetime('now') OR claimed_by = ?))
      )
    `).run(this.workerId, jobId, this.workerId);

    return result.changes > 0;
  }

  /**
   * Cooperative cancellation check for a job.
   */
  isCancelRequested(jobId: string): boolean {
    const db = getDb();
    const row = db.prepare('SELECT cancel_requested_at, status FROM discovery_jobs WHERE id = ?').get(jobId) as {
      cancel_requested_at?: string | null;
      status: string;
    } | undefined;
    return Boolean(row?.cancel_requested_at || row?.status === 'cancelled');
  }

  /**
   * Request job cancellation.
   */
  cancelJob(jobId: string): { success: boolean; message: string; job?: DiscoveryJobDTO } {
    const db = getDb();
    const row = db.prepare('SELECT * FROM discovery_jobs WHERE id = ?').get(jobId) as DiscoveryJobEntity | undefined;
    if (!row) {
      return { success: false, message: `Job not found: ${jobId}` };
    }

    if (row.status === 'completed' || row.status === 'partially_completed') {
      return { success: false, message: `Cannot cancel an already completed job (${row.status}).` };
    }

    if (row.status === 'failed') {
      return { success: false, message: 'Cannot cancel a failed job. You can retry it instead.' };
    }

    if (row.status === 'cancelled') {
      return { success: true, message: 'Job is already cancelled.', job: discoveryJobEntityToDto(row) };
    }

    if (row.status === 'queued' || row.status === 'pending') {
      db.prepare(`
        UPDATE discovery_jobs
        SET status = 'cancelled',
            cancel_requested_at = datetime('now'),
            completed_at = datetime('now'),
            claimed_by = NULL,
            claimed_at = NULL,
            lease_expires_at = NULL,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(jobId);
    } else {
      // running state: mark cancel requested, let worker checkpoint cancel cooperatively
      db.prepare(`
        UPDATE discovery_jobs
        SET cancel_requested_at = datetime('now'),
            updated_at = datetime('now')
        WHERE id = ?
      `).run(jobId);
    }

    const updated = db.prepare('SELECT * FROM discovery_jobs WHERE id = ?').get(jobId) as DiscoveryJobEntity;
    return {
      success: true,
      message: 'Cancellation requested successfully.',
      job: discoveryJobEntityToDto(updated),
    };
  }

  /**
   * Retry an eligible failed or cancelled job.
   */
  retryJob(jobId: string): { success: boolean; message: string; job?: DiscoveryJobDTO } {
    const db = getDb();
    const row = db.prepare('SELECT * FROM discovery_jobs WHERE id = ?').get(jobId) as DiscoveryJobEntity | undefined;
    if (!row) {
      return { success: false, message: `Job not found: ${jobId}` };
    }

    if (row.status === 'completed') {
      return { success: false, message: 'Cannot retry a completed job.' };
    }

    if (row.status === 'running') {
      return { success: false, message: 'Job is currently running.' };
    }

    if (row.status === 'queued' || row.status === 'pending') {
      return { success: true, message: 'Job is already queued for execution.', job: discoveryJobEntityToDto(row) };
    }

    // Reset status to queued for retry
    db.prepare(`
      UPDATE discovery_jobs
      SET status = 'queued',
          retry_count = retry_count + 1,
          error_message = NULL,
          last_error_category = NULL,
          next_retry_at = NULL,
          cancel_requested_at = NULL,
          claimed_by = NULL,
          claimed_at = NULL,
          lease_expires_at = NULL,
          completed_at = NULL,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(jobId);

    // Trigger immediate execution tick
    void this.trigger();

    const updated = db.prepare('SELECT * FROM discovery_jobs WHERE id = ?').get(jobId) as DiscoveryJobEntity;
    return {
      success: true,
      message: 'Job scheduled for retry.',
      job: discoveryJobEntityToDto(updated),
    };
  }

  /**
   * Process a single job end-to-end with durable recovery and error handling.
   */
  async processJob(jobId: string): Promise<DiscoveryJobDTO> {
    const db = getDb();

    // 1. Attempt atomic claim
    const claimed = this.claimJob(jobId);
    if (!claimed) {
      const current = db.prepare('SELECT * FROM discovery_jobs WHERE id = ?').get(jobId) as DiscoveryJobEntity | undefined;
      if (!current) {
        throw new Error(`Discovery job not found: ${jobId}`);
      }
      return discoveryJobEntityToDto(current);
    }

    let job = db.prepare('SELECT * FROM discovery_jobs WHERE id = ?').get(jobId) as DiscoveryJobEntity;
    const queryParams: { domain: string; limit?: number; targetRoles?: string[] } = JSON.parse(job.query_params);
    const domainNorm = queryParams.domain;
    const limit = queryParams.limit || 10;
    const targetRoles = queryParams.targetRoles;

    // Check cancellation before calling provider
    if (this.isCancelRequested(jobId)) {
      db.prepare(`
        UPDATE discovery_jobs
        SET status = 'cancelled',
            completed_at = datetime('now'),
            claimed_by = NULL,
            claimed_at = NULL,
            lease_expires_at = NULL,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(jobId);
      job = db.prepare('SELECT * FROM discovery_jobs WHERE id = ?').get(jobId) as DiscoveryJobEntity;
      return discoveryJobEntityToDto(job);
    }

    // 2. Resolve provider
    const provider = providerRegistry.get(job.provider);
    if (!provider) {
      const errCat: ErrorCategory = 'invalid_config';
      const errMsg = `Unknown discovery provider: "${job.provider}".`;
      db.prepare(`
        UPDATE discovery_jobs
        SET status = 'failed',
            error_message = ?,
            last_error_category = ?,
            completed_at = datetime('now'),
            claimed_by = NULL,
            claimed_at = NULL,
            lease_expires_at = NULL,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(errMsg, errCat, jobId);
      job = db.prepare('SELECT * FROM discovery_jobs WHERE id = ?').get(jobId) as DiscoveryJobEntity;
      return discoveryJobEntityToDto(job);
    }

    // Explicit error if real provider requested but not configured
    if (provider.mode === 'real' && !provider.isConfigured()) {
      const errCat: ErrorCategory = 'auth_failure';
      const errMsg = `Real discovery via "${provider.displayName}" is unavailable because HUNTER_API_KEY is not configured in the server environment. Please set HUNTER_API_KEY or select Demo Mode ("mock").`;
      db.prepare(`
        UPDATE discovery_jobs
        SET status = 'failed',
            error_message = ?,
            last_error_category = ?,
            completed_at = datetime('now'),
            claimed_by = NULL,
            claimed_at = NULL,
            lease_expires_at = NULL,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(errMsg, errCat, jobId);
      job = db.prepare('SELECT * FROM discovery_jobs WHERE id = ?').get(jobId) as DiscoveryJobEntity;
      return discoveryJobEntityToDto(job);
    }

    // 3. Provider Search OUTSIDE database transaction
    let rawCandidates: any[] = [];
    try {
      rawCandidates = await provider.searchDomain({
        domain: domainNorm,
        limit,
        targetRoles,
      });
    } catch (err: any) {
      const classified = this.classifyError(err);
      let nextRetryAt: string | null = null;

      if (classified.retryable && job.attempt_count < job.max_retries) {
        const backoffSeconds = classified.retryAfterSeconds
          ? classified.retryAfterSeconds
          : Math.min(300, Math.pow(2, job.attempt_count) * 2 + Math.floor(Math.random() * 3));
        const retryDate = new Date(Date.now() + backoffSeconds * 1000);
        nextRetryAt = retryDate.toISOString();
      }

      db.prepare(`
        UPDATE discovery_jobs
        SET status = 'failed',
            error_message = ?,
            last_error_category = ?,
            next_retry_at = ?,
            completed_at = datetime('now'),
            claimed_by = NULL,
            claimed_at = NULL,
            lease_expires_at = NULL,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(classified.message, classified.category, nextRetryAt, jobId);

      job = db.prepare('SELECT * FROM discovery_jobs WHERE id = ?').get(jobId) as DiscoveryJobEntity;
      return discoveryJobEntityToDto(job);
    }

    // 4. Candidate Processing & Staging with Checkpoints
    let processedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    // Fetch active ICP profile
    const activeIcp = icpService.getActive();

    // Fetch existing leads for deduplication
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
      INSERT OR REPLACE INTO discovered_candidates (
        id, job_id, provider, mode, external_id, company_name, company_domain,
        contact_name, title, email, email_verification, confidence_score, linkedin,
        location, industry, company_size, source_urls, provenance_metadata,
        icp_score_preview, icp_tier_preview, dedup_status, existing_lead_id, status,
        processing_error, is_mock, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'staged', ?, ?, datetime('now'))
    `);

    for (let idx = 0; idx < rawCandidates.length; idx++) {
      // Cooperative cancellation check between candidates
      if (this.isCancelRequested(jobId)) {
        db.prepare(`
          UPDATE discovery_jobs
          SET status = 'cancelled',
              candidates_found = ?,
              total_found = ?,
              candidates_processed = ?,
              candidates_failed = ?,
              candidates_skipped = ?,
              completed_at = datetime('now'),
              claimed_by = NULL,
              claimed_at = NULL,
              lease_expires_at = NULL,
              updated_at = datetime('now')
          WHERE id = ?
        `).run(rawCandidates.length, rawCandidates.length, processedCount, failedCount, skippedCount, jobId);

        job = db.prepare('SELECT * FROM discovery_jobs WHERE id = ?').get(jobId) as DiscoveryJobEntity;
        return discoveryJobEntityToDto(job);
      }

      const c = rawCandidates[idx];
      const candId = `cand-${jobId}-${idx + 1}`;
      const candEmail = dataQualityService.normalizeEmail(c.email);
      const candDomain = dataQualityService.normalizeDomain(c.companyDomain || domainNorm);
      const candCompany = dataQualityService.normalizeCompany(c.companyName);
      const candTitle = dataQualityService.normalizeTitle(c.title);

      try {
        let dedupStatus: 'new' | 'existing_lead' | 'same_company_existing' | 'duplicate_in_job' = 'new';
        let existingLeadId: string | null = null;

        if (candEmail && emailToLeadId.has(candEmail)) {
          dedupStatus = 'existing_lead';
          existingLeadId = emailToLeadId.get(candEmail) || null;
          skippedCount++;
        } else if (candEmail && seenEmailsInJob.has(candEmail)) {
          dedupStatus = 'duplicate_in_job';
          skippedCount++;
        } else if (domainToLeadId.has(candDomain)) {
          dedupStatus = 'same_company_existing';
          existingLeadId = domainToLeadId.get(candDomain) || null;
        }

        if (candEmail) {
          seenEmailsInJob.add(candEmail);
        }

        // Deterministic ICP Qualification Preview
        let scorePreview: number | null = null;
        let tierPreview: LeadScoreTier | null = null;

        if (activeIcp) {
          const previewLead: any = {
            id: c.externalId || candId,
            name: c.fullName,
            title: candTitle,
            company: candCompany,
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
          candCompany,
          candDomain,
          c.fullName,
          candTitle,
          candEmail || null,
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
          null, // processing_error
          c.isMock ? 1 : 0
        );

        processedCount++;
      } catch (candErr: any) {
        failedCount++;
        console.error(`[DiscoveryQueue] Failed to stage candidate ${candId}:`, candErr);
      }
    }

    // 5. Finalize Job Status
    const finalStatus: DiscoveryJobStatus =
      failedCount > 0 && processedCount > 0
        ? 'partially_completed'
        : failedCount > 0 && processedCount === 0
          ? 'failed'
          : 'completed';

    db.prepare(`
      UPDATE discovery_jobs
      SET status = ?,
          total_found = ?,
          candidates_found = ?,
          candidates_processed = ?,
          candidates_failed = ?,
          candidates_skipped = ?,
          completed_at = datetime('now'),
          claimed_by = NULL,
          claimed_at = NULL,
          lease_expires_at = NULL,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      finalStatus,
      rawCandidates.length,
      rawCandidates.length,
      processedCount,
      failedCount,
      skippedCount,
      jobId
    );

    // Log activity
    activityService.log(
      'discovery',
      `Outbound Discovery (${provider.mode.toUpperCase()})`,
      `Found ${rawCandidates.length} candidate contacts at ${domainNorm} via ${provider.displayName} (${processedCount} staged)`,
      `${rawCandidates.length} Found`
    );

    job = db.prepare('SELECT * FROM discovery_jobs WHERE id = ?').get(jobId) as DiscoveryJobEntity;
    return discoveryJobEntityToDto(job);
  }

  /**
   * Run one tick of background polling.
   */
  async pollAndProcess(): Promise<void> {
    if (this.isProcessingTick || this.isShuttingDown) {
      return;
    }

    this.isProcessingTick = true;
    try {
      const db = getDb();
      // Find eligible queued jobs
      const nextJob = db.prepare(`
        SELECT id FROM discovery_jobs
        WHERE status IN ('queued', 'pending')
          AND (next_retry_at IS NULL OR next_retry_at <= datetime('now'))
        ORDER BY created_at ASC
        LIMIT 1
      `).get() as { id: string } | undefined;

      if (nextJob) {
        await this.processJob(nextJob.id);
      }
    } catch (err) {
      console.error('[DiscoveryQueue] Error in pollAndProcess:', err);
    } finally {
      this.isProcessingTick = false;
    }
  }

  /**
   * Trigger queue run immediately.
   */
  async trigger(): Promise<void> {
    setImmediate(() => {
      void this.pollAndProcess();
    });
  }

  /**
   * Start background worker.
   */
  startWorker(intervalMs: number = 2000): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isShuttingDown = false;

    // Run startup recovery
    const recovery = this.recoverAbandonedJobs();
    if (recovery.recoveredCount > 0 || recovery.failedCount > 0) {
      console.log(`[DiscoveryQueue] Recovered ${recovery.recoveredCount} abandoned jobs, failed ${recovery.failedCount}`);
    }

    // Start polling loop
    this.timer = setInterval(() => {
      void this.pollAndProcess();
    }, intervalMs);

    // Initial tick
    void this.trigger();
  }

  /**
   * Graceful worker shutdown.
   */
  stopWorker(): void {
    this.isShuttingDown = true;
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const discoveryQueueService = new DiscoveryQueueService();
