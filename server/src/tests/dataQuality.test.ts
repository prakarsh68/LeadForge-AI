import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext, type TestContext } from './testHelper.js';
import { dataQualityService } from '../services/dataQualityService.js';
import type { FieldProvenance } from '../types/index.js';

describe('Phase 3B.4: Data Quality, Enrichment Reliability & Qualification Freshness', () => {
  let ctx: TestContext;

  before(async () => {
    ctx = await createTestContext();
  });

  after(async () => {
    await ctx.cleanup();
  });

  // ==============================================================
  // 1. DATA QUALITY & DETERMINISTIC PRECEDENCE POLICY
  // ==============================================================
  test('Quality rank order: manual (4) > verified (3) > inferred/risky (2) > unverified (1) > empty (0)', () => {
    const manualRank = dataQualityService.getQualityRank(undefined, true);
    assert.equal(manualRank, 4);

    const verifiedProv: FieldProvenance = {
      fieldName: 'email',
      value: 'alex@stripe.com',
      sourceProvider: 'hunter',
      retrievedAt: new Date().toISOString(),
      verificationStatus: 'verified',
      confidence: 95,
    };
    assert.equal(dataQualityService.getQualityRank(verifiedProv), 3);

    const riskyProv: FieldProvenance = {
      fieldName: 'email',
      value: 'alex@stripe.com',
      sourceProvider: 'hunter',
      retrievedAt: new Date().toISOString(),
      verificationStatus: 'risky',
      confidence: 60,
    };
    assert.equal(dataQualityService.getQualityRank(riskyProv), 2);

    const unverifiedProv: FieldProvenance = {
      fieldName: 'email',
      value: 'alex@stripe.com',
      sourceProvider: 'hunter',
      retrievedAt: new Date().toISOString(),
      verificationStatus: 'unverified',
      confidence: 30,
    };
    assert.equal(dataQualityService.getQualityRank(unverifiedProv), 1);

    assert.equal(dataQualityService.getQualityRank(undefined, false), 0);
  });

  test('Precedence policy: verified provider cannot overwrite manual edit', () => {
    const verifiedProv: FieldProvenance = {
      fieldName: 'title',
      value: 'Account Executive',
      sourceProvider: 'hunter',
      retrievedAt: new Date().toISOString(),
      verificationStatus: 'verified',
      confidence: 90,
    };

    const res = dataQualityService.evaluateFieldUpdate(
      'title',
      'Vice President of Sales', // manual value
      undefined,
      'Account Executive',       // incoming value
      verifiedProv,
      true                       // existing is manual edit
    );

    assert.equal(res.finalValue, 'Vice President of Sales', 'Manual edit must be preserved');
    assert.ok(res.conflict, 'Conflict must be recorded');
    assert.equal(res.conflict?.resolution, 'preserved_existing');
    assert.equal(res.conflict?.conflictingValue, 'Account Executive');
  });

  test('Precedence policy: verified provider overwrites unverified or missing value', () => {
    const unverifiedProv: FieldProvenance = {
      fieldName: 'title',
      value: 'Staff Member',
      sourceProvider: 'web_scrape',
      retrievedAt: new Date().toISOString(),
      verificationStatus: 'unverified',
      confidence: 20,
    };

    const verifiedProv: FieldProvenance = {
      fieldName: 'title',
      value: 'Chief Technology Officer',
      sourceProvider: 'hunter',
      retrievedAt: new Date().toISOString(),
      verificationStatus: 'verified',
      confidence: 95,
    };

    const res = dataQualityService.evaluateFieldUpdate(
      'title',
      'Staff Member',
      unverifiedProv,
      'Chief Technology Officer',
      verifiedProv,
      false
    );

    assert.equal(res.finalValue, 'Chief Technology Officer', 'Higher precedence provider must be adopted');
    assert.ok(res.conflict);
    assert.equal(res.conflict?.resolution, 'overwritten_by_higher_precedence');
    assert.equal(res.conflict?.existingValue, 'Staff Member');
  });

  test('Precedence policy: empty incoming value never overwrites existing value', () => {
    const res = dataQualityService.evaluateFieldUpdate(
      'company',
      'Acme Global',
      undefined,
      '',
      undefined,
      false
    );

    assert.equal(res.finalValue, 'Acme Global');
    assert.equal(res.conflict, null);
  });

  test('Normalizers produce consistent, clean domains and emails', () => {
    assert.equal(dataQualityService.normalizeDomain('https://WWW.Stripe.COM/pricing?ref=test'), 'stripe.com');
    assert.equal(dataQualityService.normalizeDomain('http://ramp.com:8080/'), 'ramp.com');
    assert.equal(dataQualityService.normalizeEmail('  John.Doe@Ramp.COM  '), 'john.doe@ramp.com');
    assert.equal(dataQualityService.normalizeTitle('   Senior VP Sales  '), 'Senior VP Sales');
  });

  // ==============================================================
  // 2. QUALIFICATION FRESHNESS & STALENESS DETECTION
  // ==============================================================
  test('Updating scoring-relevant field marks lead qualification as stale', async () => {
    // 1. Create a lead and qualify it
    const createRes = await ctx.request('/api/leads', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Jordan Belfort',
        title: 'VP of Sales',
        company: 'WallStreet SaaS',
        industry: 'FinTech & Payments',
        companySize: '100 - 250',
        email: 'jordan@wallstreet-saas.com',
      }),
    });
    assert.equal(createRes.status, 201);
    const leadId = createRes.body.data.id;

    // 2. Qualify lead
    const qualRes = await ctx.request(`/api/leads/${leadId}/qualify`, { method: 'POST' });
    assert.equal(qualRes.status, 200);
    assert.equal(qualRes.body.data.lead.isQualificationStale, false);
    assert.ok(qualRes.body.data.lead.qualifiedAt);

    // 3. Update an unrelated field (notes)
    const updateNotesRes = await ctx.request(`/api/leads/${leadId}`, {
      method: 'PATCH',
      body: JSON.stringify({ notes: 'Updated notes after follow-up call' }),
    });
    assert.equal(updateNotesRes.status, 200);
    assert.equal(updateNotesRes.body.data.isQualificationStale, false, 'Unrelated notes update must NOT mark qualification stale');

    // 4. Update an unrelated field (dealValue)
    const updateDealRes = await ctx.request(`/api/leads/${leadId}`, {
      method: 'PATCH',
      body: JSON.stringify({ dealValue: 95000 }),
    });
    assert.equal(updateDealRes.status, 200);
    assert.equal(updateDealRes.body.data.isQualificationStale, false, 'Unrelated dealValue update must NOT mark qualification stale');

    // 5. Update a scoring-relevant field (industry)
    const updateIndustryRes = await ctx.request(`/api/leads/${leadId}`, {
      method: 'PATCH',
      body: JSON.stringify({ industry: 'Consumer Retail & Apparel' }),
    });
    assert.equal(updateIndustryRes.status, 200);
    assert.equal(updateIndustryRes.body.data.isQualificationStale, true, 'Scoring-relevant industry update MUST mark qualification stale');

    // 6. Re-qualify lead resets staleness to false
    const requalRes = await ctx.request(`/api/leads/${leadId}/qualify`, { method: 'POST' });
    assert.equal(requalRes.status, 200);
    assert.equal(requalRes.body.data.lead.isQualificationStale, false, 'Re-qualification must clear stale flag');
  });

  test('Updating title marks qualification as stale', async () => {
    const createRes = await ctx.request('/api/leads', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Rachel Zane',
        title: 'VP of Sales Operations',
        company: 'LegalCloud Corp',
        industry: 'Enterprise Software & Cloud',
        email: 'rachel@legalcloud.io',
      }),
    });
    const leadId = createRes.body.data.id;
    await ctx.request(`/api/leads/${leadId}/qualify`, { method: 'POST' });

    // Change title to an intern / junior role
    const updateRes = await ctx.request(`/api/leads/${leadId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Junior Intern' }),
    });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.data.isQualificationStale, true);
  });

  // ==============================================================
  // 3. INGESTION REVALIDATION & IDENTITY MATCHING SAFEGUARDS
  // ==============================================================
  test('Ingestion time revalidation: rejects candidate whose email was added to CRM after discovery', async () => {
    // 1. Run discovery job for ramp.com
    const jobRes = await ctx.request('/api/discovery/jobs', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'mock',
        domain: 'fresh-revalidation-test.com',
        limit: 2,
      }),
    });
    assert.equal(jobRes.status, 201);
    const candidate = jobRes.body.data.candidates[0];
    assert.ok(candidate && candidate.email);

    // 2. Manually insert a CRM lead with the exact same email BEFORE candidate is ingested
    const crmLeadRes = await ctx.request('/api/leads', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Direct CRM Contact',
        company: 'Fresh Revalidation Corp',
        email: candidate.email,
        industry: 'Enterprise Software & Cloud',
      }),
    });
    assert.equal(crmLeadRes.status, 201);

    // 3. Now attempt single ingestion of the staged candidate
    const ingestRes = await ctx.request(`/api/discovery/candidates/${candidate.id}/ingest`, {
      method: 'POST',
    });

    // Must be rejected because contact already exists in CRM
    assert.equal(ingestRes.status, 400);
    assert.equal(ingestRes.body.success, false);
    assert.ok(ingestRes.body.error.includes('already exists in CRM'));

    // Candidate dedupStatus in DB must be updated to 'existing_lead'
    const candCheckRes = await ctx.request(`/api/discovery/candidates`);
    const updatedCand = candCheckRes.body.data.find((c: any) => c.id === candidate.id);
    assert.ok(updatedCand);
    assert.equal(updatedCand.dedupStatus, 'existing_lead');
  });

  // ==============================================================
  // 4. BATCH INGESTION TRANSACTION SAFETY & IDEMPOTENCE
  // ==============================================================
  test('Batch ingestion processes per-candidate atomic savepoints; failure does not rollback successes', async () => {
    // 1. Run discovery job with 3 candidates
    const jobRes = await ctx.request('/api/discovery/jobs', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'mock',
        domain: 'atomic-batch-testing.com',
        limit: 3,
      }),
    });
    assert.equal(jobRes.status, 201);
    const candidates = jobRes.body.data.candidates;
    assert.ok(candidates.length >= 2);

    const goodCandId = candidates[0].id;
    const invalidCandId = 'cand-non-existent-9999';

    // 2. Run batch ingestion with 1 good candidate and 1 non-existent candidate
    const batchRes = await ctx.request('/api/discovery/candidates/ingest-batch', {
      method: 'POST',
      body: JSON.stringify({
        candidateIds: [goodCandId, invalidCandId],
      }),
    });

    assert.equal(batchRes.status, 200);
    assert.equal(batchRes.body.success, true);
    assert.equal(batchRes.body.data.counts.total, 2);
    assert.equal(batchRes.body.data.counts.ingested, 1, 'Valid candidate must be committed');
    assert.equal(batchRes.body.data.counts.failed, 1, 'Invalid candidate must fail cleanly');
    assert.equal(batchRes.body.data.failed[0].candidateId, invalidCandId);

    // 3. Verify good candidate was indeed committed to leads and opportunity
    const leadCheck = await ctx.request(`/api/leads/${batchRes.body.data.ingested[0].lead.id}`);
    assert.equal(leadCheck.status, 200);
    assert.ok(leadCheck.body.data.enrichedAt, 'Enrichment timestamp must be recorded');
  });

  test('Batch ingestion is strictly idempotent: re-submitting same batch results in 0 ingested and all skipped', async () => {
    // 1. Run discovery job
    const jobRes = await ctx.request('/api/discovery/jobs', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'mock',
        domain: 'idempotent-bulk-test.com',
        limit: 2,
      }),
    });
    assert.equal(jobRes.status, 201);
    const candIds = jobRes.body.data.candidates.map((c: any) => c.id);

    // 2. First pass: ingest both
    const pass1 = await ctx.request('/api/discovery/candidates/ingest-batch', {
      method: 'POST',
      body: JSON.stringify({ candidateIds: candIds }),
    });
    assert.equal(pass1.status, 200);
    assert.equal(pass1.body.data.counts.ingested, candIds.length);

    // 3. Second pass with exact same IDs: must skip all without error
    const pass2 = await ctx.request('/api/discovery/candidates/ingest-batch', {
      method: 'POST',
      body: JSON.stringify({ candidateIds: candIds }),
    });
    assert.equal(pass2.status, 200);
    assert.equal(pass2.body.data.counts.total, candIds.length);
    assert.equal(pass2.body.data.counts.ingested, 0, 'Must NOT ingest duplicates');
    assert.equal(pass2.body.data.counts.skipped, candIds.length, 'Must cleanly skip all candidates');
    assert.equal(pass2.body.data.counts.failed, 0);
  });
});
