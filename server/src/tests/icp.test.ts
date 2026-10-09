import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext, type TestContext } from './testHelper.js';

describe('ICP Profiles API (/api/icp-profiles)', () => {
  let ctx: TestContext;

  before(async () => {
    ctx = await createTestContext();
  });

  after(async () => {
    await ctx.cleanup();
  });

  it('GET /api/icp-profiles returns all profiles with arrays parsed', async () => {
    const res = await ctx.request('/api/icp-profiles');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 1);
    assert.ok(Array.isArray(res.body.data[0].targetIndustries));
    assert.ok(Array.isArray(res.body.data[0].buyingTriggers));
    assert.equal(typeof res.body.data[0].isActive, 'boolean');
  });

  it('GET /api/icp-profiles/active returns current active profile', async () => {
    const res = await ctx.request('/api/icp-profiles/active');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.isActive, true);
  });

  it('GET /api/icp-profiles/:id returns profile or 404', async () => {
    const res = await ctx.request('/api/icp-profiles/icp-default');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.id, 'icp-default');

    const notFound = await ctx.request('/api/icp-profiles/non-existent');
    assert.equal(notFound.status, 404);
  });

  it('POST /api/icp-profiles enforces atomic single-active guarantee', async () => {
    const newProfile = {
      name: 'Cybersecurity & FinTech Target ICP',
      description: 'Focus on Series B+ security infrastructure companies.',
      targetIndustries: ['Cybersecurity', 'FinTech & Payments'],
      minScoreThreshold: 82,
      isActive: true, // This should atomically deactivate the default profile!
    };

    const createRes = await ctx.request('/api/icp-profiles', {
      method: 'POST',
      body: JSON.stringify(newProfile),
    });

    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.success, true);
    assert.equal(createRes.body.data.isActive, true);

    const newId = createRes.body.data.id;

    // Check all profiles - exactly one must have isActive = true
    const listRes = await ctx.request('/api/icp-profiles');
    const activeProfiles = listRes.body.data.filter((p: any) => p.isActive === true);
    assert.equal(activeProfiles.length, 1);
    assert.equal(activeProfiles[0].id, newId);

    // Verify original default profile is now inactive
    const defaultRes = await ctx.request('/api/icp-profiles/icp-default');
    assert.equal(defaultRes.body.data.isActive, false);
  });

  it('PATCH /api/icp-profiles/:id switches active profile atomically', async () => {
    // Reactivate icp-default
    const activateRes = await ctx.request('/api/icp-profiles/icp-default', {
      method: 'PATCH',
      body: JSON.stringify({ isActive: true }),
    });

    assert.equal(activateRes.status, 200);
    assert.equal(activateRes.body.data.isActive, true);

    // Verify only 1 profile is active across whole database
    const listRes = await ctx.request('/api/icp-profiles');
    const activeProfiles = listRes.body.data.filter((p: any) => p.isActive === true);
    assert.equal(activeProfiles.length, 1);
    assert.equal(activeProfiles[0].id, 'icp-default');
  });

  it('POST /api/icp-profiles validates required fields', async () => {
    const invalid = await ctx.request('/api/icp-profiles', {
      method: 'POST',
      body: JSON.stringify({ description: 'Missing name' }),
    });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.success, false);
  });
});
