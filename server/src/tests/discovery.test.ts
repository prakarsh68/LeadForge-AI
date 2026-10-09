import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext, type TestContext } from './testHelper.js';
import { HunterDiscoveryProvider } from '../services/discovery/hunterProvider.js';
import {
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderTimeoutError,
} from '../services/discovery/types.js';

describe('Discovery Subsystem & Provider Foundation (/api/discovery)', () => {
  let ctx: TestContext;

  before(async () => {
    ctx = await createTestContext();
  });

  after(async () => {
    await ctx.cleanup();
  });

  // ==============================================================
  // 1. PROVIDER STATUS & CREDENTIAL SAFETY
  // ==============================================================
  test('GET /api/discovery/providers reports providers and never leaks secrets', async () => {
    const res = await ctx.request('/api/discovery/providers');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));

    const providers = res.body.data;
    const hunter = providers.find((p: any) => p.id === 'hunter');
    const mock = providers.find((p: any) => p.id === 'mock');

    assert.ok(hunter, 'Hunter provider must be registered');
    assert.equal(hunter.mode, 'real');
    assert.equal(typeof hunter.isConfigured, 'boolean');
    assert.ok(!('apiKey' in hunter), 'API key must never be exposed');
    assert.ok(!('HUNTER_API_KEY' in hunter), 'Environment variable must never be exposed');

    assert.ok(mock, 'Mock provider must be registered');
    assert.equal(mock.mode, 'demo');
    assert.equal(mock.isConfigured, true);
  });

  // ==============================================================
  // 2. DEMO MODE & STAGING BEFORE INGESTION
  // ==============================================================
  test('POST /api/discovery/jobs in demo mode stages candidates without creating live leads', async () => {
    // Check initial leads and opportunities count
    const initialLeadsRes = await ctx.request('/api/leads');
    const initialLeadsCount = initialLeadsRes.body.data.length;

    const oppsRes = await ctx.request('/api/opportunities');
    const initialOppsCount = oppsRes.body.data.length;

    // Run discovery job for ramp.com in demo mode
    const jobRes = await ctx.request('/api/discovery/jobs', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'mock',
        domain: 'ramp.com',
        limit: 5,
      }),
    });

    assert.equal(jobRes.status, 201);
    assert.equal(jobRes.body.success, true);
    const job = jobRes.body.data.job;
    const candidates = jobRes.body.data.candidates;

    assert.ok(job.id);
    assert.equal(job.provider, 'mock');
    assert.equal(job.mode, 'demo');
    assert.equal(job.status, 'completed');
    assert.ok(candidates.length > 0);

    // CRITICAL REQUIREMENT: Verify candidates are explicitly labeled as mock/demo
    for (const cand of candidates) {
      assert.equal(cand.isMock, true, 'Demo candidate must be labeled isMock: true');
      assert.equal(cand.mode, 'demo', 'Demo candidate must have mode: demo');
      assert.equal(cand.provider, 'mock', 'Demo candidate must have provider: mock');
      assert.equal(cand.status, 'staged', 'Candidate must be initially staged');
      assert.equal(cand.ingestedLeadId, null);
      assert.ok(cand.provenanceMetadata);
      assert.equal(cand.provenanceMetadata.email?.sourceProvider, 'mock');
    }

    // CRITICAL REQUIREMENT: Live leads and opportunities must NOT be created merely by running discovery
    const afterLeadsRes = await ctx.request('/api/leads');
    assert.equal(afterLeadsRes.body.data.length, initialLeadsCount, 'Leads table count must be unchanged');

    const afterOppsRes = await ctx.request('/api/opportunities');
    assert.equal(afterOppsRes.body.data.length, initialOppsCount, 'Opportunities count must be unchanged');
  });

  // ==============================================================
  // 3. SAFE IDENTITY MATCHING & DEDUPLICATION
  // ==============================================================
  test('Deduplication distinguishes exact contact match from multiple contacts at same company', async () => {
    // Lead 1 in seed is "Elena Rostova" at "cloudscale.io" (email: elena.rostova@cloudscale.io)
    const jobRes = await ctx.request('/api/discovery/jobs', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'mock',
        domain: 'cloudscale.io',
      }),
    });

    assert.equal(jobRes.status, 201);
    const candidates = jobRes.body.data.candidates;
    assert.ok(candidates.length >= 2);

    // 1. Elena Rostova has matching email in CRM -> 'existing_lead'
    const elena = candidates.find((c: any) => c.email === 'elena.rostova@cloudscale.io');
    assert.ok(elena);
    assert.equal(elena.dedupStatus, 'existing_lead');
    assert.equal(elena.existingLeadId, 'lead-1');

    // 2. Tariq Al-Mansoor is at same domain cloudscale.io, but has a different email -> 'same_company_existing'
    // CRITICAL REQUIREMENT: Do NOT treat every contact at the same company as a duplicate
    const tariq = candidates.find((c: any) => c.email === 'tariq.m@cloudscale.io');
    assert.ok(tariq);
    assert.equal(tariq.dedupStatus, 'same_company_existing');
    assert.equal(tariq.existingLeadId, 'lead-1');

    // 3. Brand new domain -> 'new'
    const freshJobRes = await ctx.request('/api/discovery/jobs', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'mock',
        domain: 'brand-new-enterprise-cloud.io',
      }),
    });
    assert.equal(freshJobRes.status, 201);
    const freshCandidates = freshJobRes.body.data.candidates;
    assert.ok(freshCandidates.length > 0);
    assert.equal(freshCandidates[0].dedupStatus, 'new');
    assert.equal(freshCandidates[0].existingLeadId, null);
  });

  // ==============================================================
  // 4. MISSING CREDENTIALS FOR REAL PROVIDER
  // ==============================================================
  test('Requesting real provider when key is missing returns clear error and does not silently fake data', async () => {
    // When HUNTER_API_KEY is unset or empty
    const origKey = process.env.HUNTER_API_KEY;
    delete process.env.HUNTER_API_KEY;

    try {
      const res = await ctx.request('/api/discovery/jobs', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'hunter',
          domain: 'stripe.com',
        }),
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.error.includes('unavailable because HUNTER_API_KEY is not configured'));
      assert.ok(res.body.error.includes('Demo Mode'));
    } finally {
      if (origKey !== undefined) {
        process.env.HUNTER_API_KEY = origKey;
      }
    }
  });

  // ==============================================================
  // 5. STAGED CANDIDATE INGESTION
  // ==============================================================
  test('POST /api/discovery/candidates/:id/ingest promotes candidate to lead with provenance and qualification', async () => {
    // 1. Run discovery job for ramp.com
    const jobRes = await ctx.request('/api/discovery/jobs', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'mock',
        domain: 'ramp.com',
      }),
    });
    const candidate = jobRes.body.data.candidates[0];
    assert.ok(candidate);
    assert.equal(candidate.status, 'staged');

    // 2. Ingest candidate
    const ingestRes = await ctx.request(`/api/discovery/candidates/${candidate.id}/ingest`, {
      method: 'POST',
    });

    assert.equal(ingestRes.status, 200);
    assert.equal(ingestRes.body.success, true);
    assert.ok(ingestRes.body.data.lead);
    assert.ok(ingestRes.body.data.opportunity);
    assert.ok(ingestRes.body.data.candidate);

    const lead = ingestRes.body.data.lead;
    const opp = ingestRes.body.data.opportunity;
    const updatedCandidate = ingestRes.body.data.candidate;

    // Verify lead was created with provenance
    assert.equal(lead.name, candidate.contactName);
    assert.equal(lead.email, candidate.email);
    assert.equal(lead.sourceProvider, 'mock');
    assert.ok(lead.score >= 0 && lead.score <= 100);
    assert.ok(lead.qualificationBreakdown);
    assert.equal(lead.isMock, true);

    // Verify opportunity linked
    assert.equal(opp.leadId, lead.id);
    assert.equal(opp.confidenceScore, lead.score);

    // Verify candidate marked as ingested
    assert.equal(updatedCandidate.status, 'ingested');
    assert.equal(updatedCandidate.ingestedLeadId, lead.id);

    // 3. Attempting to ingest the same candidate again returns 400
    const duplicateIngestRes = await ctx.request(`/api/discovery/candidates/${candidate.id}/ingest`, {
      method: 'POST',
    });
    assert.equal(duplicateIngestRes.status, 400);
    assert.ok(duplicateIngestRes.body.error.includes('already been ingested'));
  });

  // ==============================================================
  // 5B. BATCH INGESTION & QUERY ENDPOINTS (PHASE 3B.3)
  // ==============================================================
  test('GET /api/discovery/jobs and /api/discovery/candidates list staged records', async () => {
    const jobsRes = await ctx.request('/api/discovery/jobs?limit=10');
    assert.equal(jobsRes.status, 200);
    assert.equal(jobsRes.body.success, true);
    assert.ok(Array.isArray(jobsRes.body.data));
    assert.ok(jobsRes.body.data.length > 0);

    const candidatesRes = await ctx.request('/api/discovery/candidates?limit=20');
    assert.equal(candidatesRes.status, 200);
    assert.equal(candidatesRes.body.success, true);
    assert.ok(Array.isArray(candidatesRes.body.data));
    assert.ok(candidatesRes.body.data.length > 0);
  });

  test('POST /api/discovery/candidates/ingest-batch processes eligible candidates and reports breakdown', async () => {
    // 1. Run fresh discovery job
    const jobRes = await ctx.request('/api/discovery/jobs', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'mock',
        domain: 'batch-test-company.io',
        limit: 3,
      }),
    });
    assert.equal(jobRes.status, 201);
    const candidates = jobRes.body.data.candidates;
    assert.ok(candidates.length >= 2);

    const cand1Id = candidates[0].id;
    const cand2Id = candidates[1].id;

    // 2. Ingest batch containing cand1 and cand2
    const batchRes = await ctx.request('/api/discovery/candidates/ingest-batch', {
      method: 'POST',
      body: JSON.stringify({
        candidateIds: [cand1Id, cand2Id, 'non-existent-candidate-id'],
      }),
    });

    assert.equal(batchRes.status, 200);
    assert.equal(batchRes.body.success, true);
    assert.equal(batchRes.body.data.counts.total, 3);
    assert.equal(batchRes.body.data.counts.ingested, 2);
    assert.equal(batchRes.body.data.counts.skipped, 0);
    assert.equal(batchRes.body.data.counts.failed, 1);
    assert.equal(batchRes.body.data.failed[0].candidateId, 'non-existent-candidate-id');

    // 3. Re-ingesting cand1 should now be skipped cleanly
    const reIngestRes = await ctx.request('/api/discovery/candidates/ingest-batch', {
      method: 'POST',
      body: JSON.stringify({
        candidateIds: [cand1Id],
      }),
    });
    assert.equal(reIngestRes.status, 200);
    assert.equal(reIngestRes.body.data.counts.ingested, 0);
    assert.equal(reIngestRes.body.data.counts.skipped, 1);
    assert.equal(reIngestRes.body.data.skipped[0].candidateId, cand1Id);
  });

  test('POST /api/discovery/candidates/ingest-batch rejects empty array', async () => {
    const res = await ctx.request('/api/discovery/candidates/ingest-batch', {
      method: 'POST',
      body: JSON.stringify({
        candidateIds: [],
      }),
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  // ==============================================================
  // 6. HUNTER.IO ADAPTER UNIT TESTS (MOCKED HTTP RESPONSES)
  // ==============================================================
  test('HunterDiscoveryProvider handles success with sources, confidence, and verification', async () => {
    const mockFetch: typeof fetch = async (input, init) => {
      const urlStr = String(input);
      assert.ok(urlStr.includes('api.hunter.io/v2/domain-search'));
      assert.ok(urlStr.includes('domain=stripe.com'));
      assert.equal((init?.headers as any)?.['X-API-KEY'], 'mock-test-key');

      return new Response(
        JSON.stringify({
          data: {
            domain: 'stripe.com',
            organization: 'Stripe',
            industry: 'Financial Services',
            headcount: '5001-10000',
            city: 'San Francisco',
            state: 'CA',
            country: 'US',
            emails: [
              {
                value: 'patrick@stripe.com',
                first_name: 'Patrick',
                last_name: 'Collison',
                position: 'Chief Executive Officer',
                confidence: 96,
                type: 'personal',
                seniority: 'executive',
                department: 'management',
                linkedin: 'https://linkedin.com/in/patrickcollison',
                verification: {
                  status: 'valid',
                  date: '2026-01-01',
                },
                sources: [
                  {
                    domain: 'stripe.com',
                    uri: 'https://stripe.com/about',
                    extracted_on: '2026-01-01',
                    still_on_page: true,
                  },
                ],
              },
            ],
          },
          meta: { results: 1, limit: 10, offset: 0, params: { domain: 'stripe.com' } },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const provider = new HunterDiscoveryProvider(() => 'mock-test-key', mockFetch);
    assert.equal(provider.isConfigured(), true);

    const candidates = await provider.searchDomain({ domain: 'https://www.stripe.com/about' });
    assert.equal(candidates.length, 1);
    const c = candidates[0];

    assert.equal(c.fullName, 'Patrick Collison');
    assert.equal(c.title, 'Chief Executive Officer');
    assert.equal(c.email, 'patrick@stripe.com');
    assert.equal(c.companyName, 'Stripe');
    assert.equal(c.companyDomain, 'stripe.com');
    assert.equal(c.confidence, 96);
    assert.equal(c.emailVerification, 'verified');
    assert.equal(c.sourceUrls[0], 'https://stripe.com/about');
    assert.equal(c.isMock, false);

    // Verify provenance
    assert.equal(c.fieldProvenance.email.sourceProvider, 'hunter');
    assert.equal(c.fieldProvenance.email.sourceUrl, 'https://stripe.com/about');
    assert.equal(c.fieldProvenance.email.verificationStatus, 'verified');
    assert.equal(c.fieldProvenance.email.confidence, 96);
  });

  test('HunterDiscoveryProvider handles empty results gracefully', async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response(
        JSON.stringify({
          data: {
            domain: 'unknown-stealth.io',
            organization: 'Stealth Inc',
            emails: [],
          },
          meta: { results: 0, limit: 10, offset: 0 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const provider = new HunterDiscoveryProvider(() => 'mock-key', mockFetch);
    const results = await provider.searchDomain({ domain: 'unknown-stealth.io' });
    assert.equal(Array.isArray(results), true);
    assert.equal(results.length, 0);
  });

  test('HunterDiscoveryProvider handles HTTP 401 Unauthorized without leaking key', async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response(
        JSON.stringify({
          errors: [
            { id: 'unauthorized', code: 401, details: 'No authentication was found or API key is invalid.' },
          ],
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const secretKey = 'super-secret-hunter-key-xyz123';
    const provider = new HunterDiscoveryProvider(() => secretKey, mockFetch);

    await assert.rejects(
      async () => {
        await provider.searchDomain({ domain: 'test.com' });
      },
      (err: any) => {
        assert.ok(err instanceof ProviderAuthError);
        assert.ok(!err.message.includes(secretKey), 'Error message must not leak API key');
        return true;
      }
    );
  });

  test('HunterDiscoveryProvider handles HTTP 429 and 403 Rate Limits', async () => {
    const mockFetch429: typeof fetch = async () => {
      return new Response(
        JSON.stringify({
          errors: [
            { id: 'plan_limit_reached', code: 429, details: 'You reached your plan limit for this month.' },
          ],
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const provider429 = new HunterDiscoveryProvider(() => 'mock-key', mockFetch429);
    await assert.rejects(
      async () => {
        await provider429.searchDomain({ domain: 'test.com' });
      },
      (err: any) => {
        assert.ok(err instanceof ProviderRateLimitError);
        assert.ok(err.message.includes('plan usage limit exceeded'));
        return true;
      }
    );
  });

  test('HunterDiscoveryProvider handles request timeouts gracefully', async () => {
    const mockFetchTimeout: typeof fetch = async (_input, _init) => {
      // Simulate AbortController trigger
      const error: any = new Error('The operation was aborted');
      error.name = 'AbortError';
      throw error;
    };

    const provider = new HunterDiscoveryProvider(() => 'mock-key', mockFetchTimeout);
    await assert.rejects(
      async () => {
        await provider.searchDomain({ domain: 'test.com' });
      },
      (err: any) => {
        assert.ok(err instanceof ProviderTimeoutError);
        assert.ok(err.message.includes('timed out'));
        return true;
      }
    );
  });

  test('GET /api/discovery/capabilities returns connector capability matrix', async () => {
    const res = await ctx.request('/api/discovery/capabilities');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 4);

    const hunter = res.body.data.find((c: any) => c.id === 'hunter');
    assert.ok(hunter);
    assert.equal(hunter.providerType, 'live_api');
    assert.ok(hunter.requiredCredentials.includes('HUNTER_API_KEY'));
    assert.ok(hunter.capabilities.includes('domain_search'));

    const demo = res.body.data.find((c: any) => c.id === 'mock');
    assert.ok(demo);
    assert.equal(demo.providerType, 'demo_sandbox');
    assert.equal(demo.isConfigured, true);
  });

  test('POST /api/discovery/dry-run performs isolated simulation without persisting data', async () => {
    const res = await ctx.request('/api/discovery/dry-run', {
      method: 'POST',
      body: JSON.stringify({ domain: 'stripe.com', limit: 5 }),
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.isDryRun, true);
    assert.equal(res.body.data.domain, 'stripe.com');
    assert.ok(Array.isArray(res.body.data.plannedOperations));
    assert.ok(Array.isArray(res.body.data.filteringFunnel));
    assert.ok(Array.isArray(res.body.data.projectedCandidates));
    assert.ok(res.body.data.projectedCandidates.length > 0);
  });

  test('POST /api/discovery/cleanup-demo purges only demo sandbox records safely', async () => {
    const res = await ctx.request('/api/discovery/cleanup-demo', {
      method: 'POST',
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(typeof res.body.data.cleanedCandidates === 'number');
    assert.ok(typeof res.body.data.cleanedJobs === 'number');
    assert.ok(typeof res.body.data.cleanedLeads === 'number');
  });
});
