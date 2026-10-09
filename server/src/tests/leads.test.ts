import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext, type TestContext } from './testHelper.js';

describe('Leads API (/api/leads)', () => {
  let ctx: TestContext;

  before(async () => {
    ctx = await createTestContext();
  });

  after(async () => {
    await ctx.cleanup();
  });

  it('GET /api/leads returns seeded leads with metadata', async () => {
    const res = await ctx.request('/api/leads');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 6);
    assert.ok(res.body.meta.total >= 6);
    assert.ok(res.body.data[0].companyDomain); // Verify camelCase serialization
    assert.ok(Array.isArray(res.body.data[0].triggers)); // Verify JSON parsing
  });

  it('GET /api/leads with search query filters correctly', async () => {
    const res = await ctx.request('/api/leads?search=CloudScale');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].company, 'CloudScale Nexus');
  });

  it('GET /api/leads with status filter returns matching leads', async () => {
    const res = await ctx.request('/api/leads?status=Proposal');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.length >= 1);
    for (const lead of res.body.data) {
      assert.equal(lead.status, 'Proposal');
    }
  });

  it('GET /api/leads with tier filter returns matching leads', async () => {
    const res = await ctx.request('/api/leads?tier=high');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    for (const lead of res.body.data) {
      assert.equal(lead.tier, 'high');
      assert.ok(lead.score >= 85);
    }
  });

  it('GET /api/leads/:id returns single lead', async () => {
    const res = await ctx.request('/api/leads/lead-1');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.id, 'lead-1');
    assert.equal(res.body.data.name, 'Elena Rostova');
  });

  it('GET /api/leads/:id returns 404 for non-existent lead', async () => {
    const res = await ctx.request('/api/leads/lead-999999');
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.ok(res.body.error.includes('not found'));
  });

  it('POST /api/leads creates lead and linked opportunity', async () => {
    const newLead = {
      name: 'Victoria Vance',
      title: 'VP Engineering',
      company: 'Quantum Logic Systems',
      email: 'victoria@quantumlogic.io',
      industry: 'Enterprise Software & Cloud',
      score: 91,
      status: 'Qualified',
      dealValue: 72000,
      triggers: ['Announced $15M round'],
    };

    const res = await ctx.request('/api/leads', {
      method: 'POST',
      body: JSON.stringify(newLead),
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.name, 'Victoria Vance');
    assert.equal(res.body.data.tier, 'high'); // Auto-assigned tier
    assert.equal(res.body.data.dealValue, 72000);

    const createdId = res.body.data.id;

    // Verify opportunity was automatically created and linked
    const oppRes = await ctx.request(`/api/opportunities/opp-${createdId}`);
    assert.equal(oppRes.status, 200);
    assert.equal(oppRes.body.data.leadId, createdId);
    assert.equal(oppRes.body.data.stage, 'Qualified');
    assert.equal(oppRes.body.data.dealValue, 72000);
  });

  it('POST /api/leads validates required fields and score bounds', async () => {
    // Missing required name
    const missingName = await ctx.request('/api/leads', {
      method: 'POST',
      body: JSON.stringify({ company: 'Test Co', email: 'test@co.com' }),
    });
    assert.equal(missingName.status, 400);
    assert.equal(missingName.body.success, false);

    // Invalid score > 100
    const invalidScore = await ctx.request('/api/leads', {
      method: 'POST',
      body: JSON.stringify({
        name: 'John',
        company: 'Test Co',
        email: 'john@co.com',
        score: 150,
      }),
    });
    assert.equal(invalidScore.status, 400);

    // Invalid status enum
    const invalidStatus = await ctx.request('/api/leads', {
      method: 'POST',
      body: JSON.stringify({
        name: 'John',
        company: 'Test Co',
        email: 'john@co.com',
        status: 'InvalidStatusString',
      }),
    });
    assert.equal(invalidStatus.status, 400);
  });

  it('PATCH /api/leads/:id updates fields and synchronizes opportunity stage', async () => {
    const updateRes = await ctx.request('/api/leads/lead-2', {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'Won',
        dealValue: 55000,
      }),
    });

    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.success, true);
    assert.equal(updateRes.body.data.status, 'Won');
    assert.equal(updateRes.body.data.dealValue, 55000);

    // Verify opportunity synchronized
    const oppRes = await ctx.request('/api/opportunities/opp-lead-2');
    assert.equal(oppRes.status, 200);
    assert.equal(oppRes.body.data.stage, 'Won');
    assert.equal(oppRes.body.data.dealValue, 55000);
  });

  it('DELETE /api/leads/:id removes lead and cascades', async () => {
    const delRes = await ctx.request('/api/leads/lead-6', {
      method: 'DELETE',
    });
    assert.equal(delRes.status, 200);
    assert.equal(delRes.body.success, true);

    const getRes = await ctx.request('/api/leads/lead-6');
    assert.equal(getRes.status, 404);

    const getOpp = await ctx.request('/api/opportunities/opp-lead-6');
    assert.equal(getOpp.status, 404);
  });
});

