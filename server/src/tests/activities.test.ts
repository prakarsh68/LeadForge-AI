import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext, type TestContext } from './testHelper.js';

describe('Activities API (/api/activities)', () => {
  let ctx: TestContext;

  before(async () => {
    ctx = await createTestContext();
  });

  after(async () => {
    await ctx.cleanup();
  });

  it('GET /api/activities returns activities list with metadata', async () => {
    const res = await ctx.request('/api/activities');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 2);
  });

  it('GET /api/activities?limit=1 limits output', async () => {
    const res = await ctx.request('/api/activities?limit=1');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
  });

  it('POST /api/activities logs new activity item', async () => {
    const newAct = {
      type: 'outreach',
      title: 'Multichannel Sequence Triggered',
      description: 'Follow-up email dispatched via custom webhook',
      badge: 'Email Queued',
    };

    const res = await ctx.request('/api/activities', {
      method: 'POST',
      body: JSON.stringify(newAct),
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.title, 'Multichannel Sequence Triggered');
    assert.equal(res.body.data.badge, 'Email Queued');
  });

  it('POST /api/activities rejects invalid type or empty title', async () => {
    const invalidType = await ctx.request('/api/activities', {
      method: 'POST',
      body: JSON.stringify({ type: 'invalid_type', title: 'Test', description: 'Desc' }),
    });
    assert.equal(invalidType.status, 400);

    const missingTitle = await ctx.request('/api/activities', {
      method: 'POST',
      body: JSON.stringify({ type: 'discovery', description: 'Desc' }),
    });
    assert.equal(missingTitle.status, 400);
  });
});

