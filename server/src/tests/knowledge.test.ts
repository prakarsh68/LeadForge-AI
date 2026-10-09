import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext, type TestContext } from './testHelper.js';

describe('Knowledge Documents API (/api/knowledge-documents)', () => {
  let ctx: TestContext;

  before(async () => {
    ctx = await createTestContext();
  });

  after(async () => {
    await ctx.cleanup();
  });

  it('GET /api/knowledge-documents returns documents list', async () => {
    const res = await ctx.request('/api/knowledge-documents');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 2);
    assert.ok(res.body.data[0].sizeOrTokens);
  });

  it('GET /api/knowledge-documents?category=Pricing filters correctly', async () => {
    const res = await ctx.request('/api/knowledge-documents?category=Pricing');
    assert.equal(res.status, 200);
    for (const doc of res.body.data) {
      assert.equal(doc.category, 'Pricing');
    }
  });

  it('GET /api/knowledge-documents/:id returns document or 404', async () => {
    const res = await ctx.request('/api/knowledge-documents/doc-1');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.id, 'doc-1');

    const notFound = await ctx.request('/api/knowledge-documents/non-existent');
    assert.equal(notFound.status, 404);
  });

  it('POST /api/knowledge-documents creates new document record', async () => {
    const newDoc = {
      title: 'Competitive Battlecard: HubSpot Outbound Automation',
      category: 'Battlecards',
      type: 'pdf',
      sizeOrTokens: '1.8 MB • 14,000 tokens',
      status: 'Indexed',
      summary: 'Differentiators vs legacy sales automation tools.',
    };

    const res = await ctx.request('/api/knowledge-documents', {
      method: 'POST',
      body: JSON.stringify(newDoc),
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.title, newDoc.title);
    assert.equal(res.body.data.category, 'Battlecards');
  });

  it('PATCH /api/knowledge-documents/:id updates document metadata', async () => {
    const updateRes = await ctx.request('/api/knowledge-documents/doc-2', {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'Ready',
        summary: 'Updated Q1 2026 pricing guidelines.',
      }),
    });

    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.success, true);
    assert.equal(updateRes.body.data.status, 'Ready');
    assert.equal(updateRes.body.data.summary, 'Updated Q1 2026 pricing guidelines.');
  });

  it('DELETE /api/knowledge-documents/:id deletes document', async () => {
    const delRes = await ctx.request('/api/knowledge-documents/doc-2', {
      method: 'DELETE',
    });
    assert.equal(delRes.status, 200);
    assert.equal(delRes.body.success, true);

    const getRes = await ctx.request('/api/knowledge-documents/doc-2');
    assert.equal(getRes.status, 404);
  });
});

