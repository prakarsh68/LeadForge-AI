import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext, type TestContext } from './testHelper.js';
import { discoveryQueueService } from '../services/discoveryQueueService.js';
import {
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderTimeoutError,
} from '../services/discovery/types.js';

describe('Phase 3C: Durable Discovery Pipeline, Recovery & Orchestration', () => {
  let ctx: TestContext;

  before(async () => {
    ctx = await createTestContext();
  });

  after(async () => {
    await ctx.cleanup();
  });

  // ==============================================================
  // 1. STATE MACHINE TRANSITIONS
  // ==============================================================
  test('State machine enforces valid transitions and rejects invalid jumps', () => {
    // Valid transitions
    assert.equal(discoveryQueueService.isValidTransition('queued', 'running'), true);
    assert.equal(discoveryQueueService.isValidTransition('queued', 'cancelled'), true);
    assert.equal(discoveryQueueService.isValidTransition('running', 'completed'), true);
    assert.equal(discoveryQueueService.isValidTransition('running', 'partially_completed'), true);
    assert.equal(discoveryQueueService.isValidTransition('running', 'failed'), true);
    assert.equal(discoveryQueueService.isValidTransition('running', 'cancelled'), true);
    assert.equal(discoveryQueueService.isValidTransition('failed', 'queued'), true);
    assert.equal(discoveryQueueService.isValidTransition('cancelled', 'queued'), true);
    assert.equal(discoveryQueueService.isValidTransition('partially_completed', 'queued'), true);

    // Invalid transitions
    assert.equal(discoveryQueueService.isValidTransition('completed', 'running'), false);
    assert.equal(discoveryQueueService.isValidTransition('completed', 'queued'), false);
    assert.equal(discoveryQueueService.isValidTransition('queued', 'completed'), false);
    assert.equal(discoveryQueueService.isValidTransition('failed', 'completed'), false);
  });

  // ==============================================================
  // 2. LEASE CLAIMING & CONCURRENCY PROTECTION
  // ==============================================================
  test('Atomic job claim sets running state and prevents overlapping concurrent execution', () => {
    const db = ctx.db;
    const testJobId = `job-claim-test-${Date.now()}`;

    // Insert queued job
    db.prepare(`
      INSERT INTO discovery_jobs (
        id, provider, mode, status, query_params, total_found,
        attempt_count, max_retries, retry_count, created_at, updated_at
      ) VALUES (?, 'mock', 'demo', 'queued', '{}', 0, 0, 3, 0, datetime('now'), datetime('now'))
    `).run(testJobId);

    // Worker claims the job
    const claimedFirst = discoveryQueueService.claimJob(testJobId);
    assert.equal(claimedFirst, true, 'First claim should succeed');

    const jobAfterClaim = db.prepare('SELECT * FROM discovery_jobs WHERE id = ?').get(testJobId) as any;
    assert.equal(jobAfterClaim.status, 'running');
    assert.equal(jobAfterClaim.claimed_by, discoveryQueueService.getWorkerId());
    assert.equal(jobAfterClaim.attempt_count, 1);
    assert.ok(jobAfterClaim.lease_expires_at);

    // Second claim while lease is active by another worker should be rejected
    // Simulate another worker instance attempting to claim
    const otherWorkerStmt = db.prepare(`
      UPDATE discovery_jobs
      SET status = 'running',
          claimed_by = 'other-worker-999',
          claimed_at = datetime('now'),
          lease_expires_at = datetime('now', '+5 minutes'),
          attempt_count = attempt_count + 1
      WHERE id = ? AND (status = 'queued' OR (status = 'running' AND lease_expires_at < datetime('now')))
    `).run(testJobId);

    assert.equal(otherWorkerStmt.changes, 0, 'Concurrent claim while lease is active must fail');
  });

  // ==============================================================
  // 3. RESTART & CRASH RECOVERY
  // ==============================================================
  test('Restart recovery resets abandoned jobs below max_retries to queued', () => {
    const db = ctx.db;
    const abandonedJobId = `job-abandoned-${Date.now()}`;

    // Simulate job abandoned by a previous dead worker process with expired lease
    db.prepare(`
      INSERT INTO discovery_jobs (
        id, provider, mode, status, query_params, total_found,
        claimed_by, claimed_at, lease_expires_at, attempt_count, max_retries, retry_count, created_at, updated_at
      ) VALUES (?, 'mock', 'demo', 'running', '{}', 0, 'dead-worker-pid-1234', datetime('now', '-10 minutes'), datetime('now', '-5 minutes'), 1, 3, 0, datetime('now', '-10 minutes'), datetime('now', '-10 minutes'))
    `).run(abandonedJobId);

    const recovery = discoveryQueueService.recoverAbandonedJobs();
    assert.ok(recovery.recoveredCount >= 1, 'Should recover at least 1 abandoned job');

    const recovered = db.prepare('SELECT * FROM discovery_jobs WHERE id = ?').get(abandonedJobId) as any;
    assert.equal(recovered.status, 'queued');
    assert.equal(recovered.claimed_by, null);
    assert.equal(recovered.last_error_category, 'recovered_after_crash');
  });

  test('Restart recovery marks abandoned jobs exceeding max_retries as failed', () => {
    const db = ctx.db;
    const exhaustedJobId = `job-exhausted-${Date.now()}`;

    // Simulate job abandoned that already reached max retries
    db.prepare(`
      INSERT INTO discovery_jobs (
        id, provider, mode, status, query_params, total_found,
        claimed_by, claimed_at, lease_expires_at, attempt_count, max_retries, retry_count, created_at, updated_at
      ) VALUES (?, 'mock', 'demo', 'running', '{}', 0, 'dead-worker-pid-5678', datetime('now', '-10 minutes'), datetime('now', '-5 minutes'), 3, 3, 0, datetime('now', '-10 minutes'), datetime('now', '-10 minutes'))
    `).run(exhaustedJobId);

    const recovery = discoveryQueueService.recoverAbandonedJobs();
    assert.ok(recovery.failedCount >= 1);

    const failed = db.prepare('SELECT * FROM discovery_jobs WHERE id = ?').get(exhaustedJobId) as any;
    assert.equal(failed.status, 'failed');
    assert.equal(failed.last_error_category, 'lease_expired');
    assert.ok(failed.error_message.includes('lease expired'));
  });

  // ==============================================================
  // 4. SANITIZED ERROR CLASSIFICATION & SECRET REDACTION
  // ==============================================================
  test('Error classification identifies categories and redacts API keys/tokens', () => {
    // 1. Auth error with exposed key
    const authErr = new ProviderAuthError('Invalid credentials with api_key="secret-key-12345" provided');
    const classifiedAuth = discoveryQueueService.classifyError(authErr);
    assert.equal(classifiedAuth.category, 'auth_failure');
    assert.equal(classifiedAuth.retryable, false);
    assert.ok(!classifiedAuth.message.includes('secret-key-12345'), 'Secret API key must be redacted');
    assert.ok(classifiedAuth.message.includes('[REDACTED]'));

    // 2. Rate limit error
    const rateErr = new ProviderRateLimitError('Too many requests, slow down', 45);
    const classifiedRate = discoveryQueueService.classifyError(rateErr);
    assert.equal(classifiedRate.category, 'rate_limit');
    assert.equal(classifiedRate.retryable, true);
    assert.equal(classifiedRate.retryAfterSeconds, 45);

    // 3. Network timeout error
    const timeoutErr = new ProviderTimeoutError('ETIMEDOUT connection to api.hunter.io');
    const classifiedTimeout = discoveryQueueService.classifyError(timeoutErr);
    assert.equal(classifiedTimeout.category, 'network_timeout');
    assert.equal(classifiedTimeout.retryable, true);
  });

  // ==============================================================
  // 5. ASYNC PIPELINE JOB CREATION & PROGRESS OBSERVABILITY
  // ==============================================================
  test('POST /api/discovery/jobs with async: true queues job and supports cancellation', async () => {
    // 1. Create async job
    const createRes = await ctx.request('/api/discovery/jobs', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'mock',
        domain: 'async-pipeline-test.com',
        limit: 5,
        async: true,
      }),
    });

    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.success, true);
    const createdJob = createRes.body.data.job;
    assert.ok(createdJob.id);
    assert.equal(createdJob.status, 'queued');

    // 2. Retrieve job by ID
    const getRes = await ctx.request(`/api/discovery/jobs/${createdJob.id}`);
    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.success, true);
    assert.equal(getRes.body.data.id, createdJob.id);

    // 3. Cancel queued job
    const cancelRes = await ctx.request(`/api/discovery/jobs/${createdJob.id}/cancel`, {
      method: 'POST',
    });

    assert.equal(cancelRes.status, 200);
    assert.equal(cancelRes.body.success, true);
    assert.equal(cancelRes.body.data.status, 'cancelled');

    // 4. Retry cancelled job
    const retryRes = await ctx.request(`/api/discovery/jobs/${createdJob.id}/retry`, {
      method: 'POST',
    });

    assert.equal(retryRes.status, 200);
    assert.equal(retryRes.body.success, true);
    assert.equal(retryRes.body.data.status, 'queued');
    assert.equal(retryRes.body.data.retryCount, 1);
  });

  // ==============================================================
  // 6. TERMINAL STATE SAFETY: COMPLETED JOB CANNOT BE RETRIED
  // ==============================================================
  test('Attempting to retry or cancel a completed job is safely rejected', async () => {
    // Run synchronous job to completion
    const jobRes = await ctx.request('/api/discovery/jobs', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'mock',
        domain: 'terminal-test.io',
        limit: 3,
      }),
    });

    assert.equal(jobRes.status, 201);
    const job = jobRes.body.data.job;
    assert.equal(job.status, 'completed');

    // Attempting to cancel completed job
    const cancelRes = await ctx.request(`/api/discovery/jobs/${job.id}/cancel`, {
      method: 'POST',
    });
    assert.equal(cancelRes.status, 400);
    assert.ok(cancelRes.body.error.includes('already completed'));

    // Attempting to retry completed job
    const retryRes = await ctx.request(`/api/discovery/jobs/${job.id}/retry`, {
      method: 'POST',
    });
    assert.equal(retryRes.status, 400);
    assert.ok(retryRes.body.error.includes('Cannot retry a completed job'));
  });

  // ==============================================================
  // 7. REAL PROVIDER REJECTION PREVENTS MOCK FALLBACK
  // ==============================================================
  test('Real provider with missing key fails explicitly and does not silently fall back', async () => {
    const origKey = process.env.HUNTER_API_KEY;
    delete process.env.HUNTER_API_KEY;

    try {
      const res = await ctx.request('/api/discovery/jobs', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'hunter',
          domain: 'live-check.io',
        }),
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.error.includes('HUNTER_API_KEY is not configured'));
    } finally {
      if (origKey !== undefined) {
        process.env.HUNTER_API_KEY = origKey;
      }
    }
  });

  // ==============================================================
  // 8. CANDIDATES INGESTED COUNTER TRACKING
  // ==============================================================
  test('Candidate ingestion increments candidates_ingested counter on discovery_jobs', async () => {
    // 1. Run discovery job
    const jobRes = await ctx.request('/api/discovery/jobs', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'mock',
        domain: 'counter-test.io',
        limit: 2,
      }),
    });

    assert.equal(jobRes.status, 201);
    const job = jobRes.body.data.job;
    const candidates = jobRes.body.data.candidates;
    assert.ok(candidates.length > 0);
    assert.equal(job.candidatesIngested, 0);

    // 2. Ingest first candidate
    const cand = candidates[0];
    const ingestRes = await ctx.request(`/api/discovery/candidates/${cand.id}/ingest`, {
      method: 'POST',
    });
    assert.equal(ingestRes.status, 200);

    // 3. Verify job updated with candidatesIngested = 1
    const freshJobRes = await ctx.request(`/api/discovery/jobs/${job.id}`);
    assert.equal(freshJobRes.status, 200);
    assert.equal(freshJobRes.body.data.candidatesIngested, 1);
  });

  // ==============================================================
  // 9. CANDIDATE QUALIFICATION PREVIEWS PRESERVE STAGED STATUS
  // ==============================================================
  test('Discovered candidates compute ICP preview without creating permanent CRM records prematurely', async () => {
    const jobRes = await ctx.request('/api/discovery/jobs', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'mock',
        domain: 'preview-scoring.io',
        limit: 2,
      }),
    });

    assert.equal(jobRes.status, 201);
    const candidates = jobRes.body.data.candidates;

    for (const c of candidates) {
      assert.equal(c.status, 'staged');
      assert.equal(c.ingestedLeadId, null);
      if (c.icpScorePreview !== null) {
        assert.ok(c.icpScorePreview >= 0 && c.icpScorePreview <= 100);
        assert.ok(['high', 'medium', 'low'].includes(c.icpTierPreview));
      }
    }
  });
});
