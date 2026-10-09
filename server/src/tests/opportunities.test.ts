import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext, type TestContext } from './testHelper.js';

describe('Opportunities & Pipeline API (/api/opportunities)', () => {
  let ctx: TestContext;

  before(async () => {
    ctx = await createTestContext();
  });

  after(async () => {
    await ctx.cleanup();
  });

  it('GET /api/opportunities returns opportunities with lead metadata', async () => {
    const res = await ctx.request('/api/opportunities');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 6);

    const first = res.body.data[0];
    assert.ok(first.id);
    assert.ok(first.leadId);
    assert.ok(first.stage);
    assert.ok(first.lead);
    assert.ok(first.lead.company);
  });

  it('GET /api/opportunities?stage=Qualified filters correctly', async () => {
    const res = await ctx.request('/api/opportunities?stage=Qualified');
    assert.equal(res.status, 200);
    for (const opp of res.body.data) {
      assert.equal(opp.stage, 'Qualified');
    }
  });

  it('GET /api/pipeline/summary computes pipeline metrics accurately', async () => {
    const res = await ctx.request('/api/pipeline/summary');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const summary = res.body.data;

    assert.ok(summary.totalPipelineValue > 0);
    assert.ok(summary.totalOpportunities >= 6);
    assert.ok(summary.stageCounts.Qualified !== undefined);
    assert.ok(summary.winRate >= 0);
    assert.ok(summary.averageDealValue > 0);
  });

  it('PATCH /api/opportunities/:id updates stage and synchronizes linked lead', async () => {
    const oppRes = await ctx.request('/api/opportunities/opp-lead-1', {
      method: 'PATCH',
      body: JSON.stringify({
        stage: 'Won',
        dealValue: 88000,
      }),
    });

    assert.equal(oppRes.status, 200);
    assert.equal(oppRes.body.success, true);
    assert.equal(oppRes.body.data.stage, 'Won');
    assert.equal(oppRes.body.data.dealValue, 88000);

    // Verify lead status was also synchronized to 'Won'
    const leadRes = await ctx.request('/api/leads/lead-1');
    assert.equal(leadRes.status, 200);
    assert.equal(leadRes.body.data.status, 'Won');
    assert.equal(leadRes.body.data.dealValue, 88000);
  });

  it('POST /api/opportunities rejects duplicate opportunity for same lead', async () => {
    const dupRes = await ctx.request('/api/opportunities', {
      method: 'POST',
      body: JSON.stringify({
        leadId: 'lead-1',
        stage: 'Proposal',
      }),
    });

    assert.equal(dupRes.status, 409); // Conflict
    assert.equal(dupRes.body.success, false);
    assert.ok(dupRes.body.error.includes('already exists'));
  });
});

