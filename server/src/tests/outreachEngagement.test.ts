import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext, type TestContext } from './testHelper.js';
import { emailGeneratorService } from '../services/outreach/emailGeneratorService.js';
import { sequenceQueueService } from '../services/outreach/sequenceQueueService.js';
import { engagementService } from '../services/outreach/engagementService.js';
import { MockEmailProvider, setEmailProvider } from '../services/outreach/emailProvider.js';
import type { LeadDTO } from '../types/index.js';

describe('Phase 5: Personalized Outreach, Engagement Intelligence & CRM Integration', () => {
  let ctx: TestContext;
  let mockEmailProvider: MockEmailProvider;

  before(async () => {
    ctx = await createTestContext();
    mockEmailProvider = new MockEmailProvider();
    setEmailProvider(mockEmailProvider);
  });

  after(async () => {
    sequenceQueueService.stopWorker();
    await ctx.cleanup();
  });

  describe('Workstream C: Evidence-Grounded Email Sequence Generation', () => {
    it('generates a 3-step sequence draft grounded in lead triggers and company data', async () => {
      const lead: LeadDTO = {
        id: 'lead-1',
        name: 'Elena Rostova',
        title: 'VP of Sales & Revenue Operations',
        company: 'CloudScale Nexus',
        companyDomain: 'cloudscale.io',
        avatar: '',
        email: 'elena.rostova@cloudscale.io',
        linkedin: '',
        location: '',
        industry: 'Enterprise Software & Cloud',
        companySize: '250 - 500',
        score: 96,
        tier: 'high',
        status: 'New',
        dealValue: 64000,
        triggers: ['Raised $28M Series B', 'Hiring 8 Sales Reps'],
        notes: '',
        lastActive: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await emailGeneratorService.generateSequence(lead);

      assert.ok(result.steps.length === 3, 'Should generate exactly 3 sequential steps');
      assert.ok(result.evidenceUsed.length >= 2, 'Should gather grounding evidence');

      // Step 1: Hook
      assert.equal(result.steps[0].stepNumber, 1);
      assert.ok(result.steps[0].subject.length > 5);
      assert.ok(result.steps[0].bodyText.includes('Elena'));
      assert.ok(result.steps[0].bodyText.includes('CloudScale Nexus'));
      assert.ok(result.steps[0].personalizationEvidence.length > 0);

      // Step 2: Social proof
      assert.equal(result.steps[1].stepNumber, 2);
      assert.ok(result.steps[1].subject.startsWith('Re:'));

      // Step 3: Breakaway
      assert.equal(result.steps[2].stepNumber, 3);
      assert.ok(result.steps[2].bodyText.toLowerCase().includes('priority') || result.steps[2].bodyText.toLowerCase().includes('close'));

      // Anti-hallucination check: should not claim prior conversation
      for (const step of result.steps) {
        assert.ok(!step.bodyText.includes('As we discussed yesterday'));
        assert.ok(!step.bodyText.includes('Per our phone call'));
      }
    });

    it('creates an enrolled sequence via REST API with 3 draft messages', async () => {
      const res = await ctx.request('/api/outreach/sequences', {
        method: 'POST',
        body: JSON.stringify({
          leadId: 'lead-1',
          campaignId: 'camp-1',
          generateDrafts: true,
        }),
      });

      assert.equal(res.status, 201);
      assert.ok(res.body.success);
      assert.equal(res.body.data.leadId, 'lead-1');
      assert.equal(res.body.data.status, 'draft');
      assert.equal(res.body.data.currentStep, 1);
      assert.equal(res.body.data.messages?.length, 3);
    });
  });

  describe('Workstream D: Sequence State Machine & Execution Safety', () => {
    let sequenceId: string;

    before(async () => {
      const seq = sequenceQueueService.createSequence('lead-2', 'camp-1');
      sequenceId = seq.id;
    });

    it('requires human approval to transition from draft to approved', async () => {
      const approveRes = await ctx.request(`/api/outreach/sequences/${sequenceId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approvedBy: 'leadforge_tester' }),
      });

      assert.equal(approveRes.status, 200);
      assert.equal(approveRes.body.data.status, 'approved');
      assert.equal(approveRes.body.data.approvedBy, 'leadforge_tester');
      assert.ok(approveRes.body.data.nextScheduledAt);
    });

    it('pauses and resumes sequence cleanly', async () => {
      const pauseRes = await ctx.request(`/api/outreach/sequences/${sequenceId}/pause`, {
        method: 'POST',
      });
      assert.equal(pauseRes.status, 200);
      assert.equal(pauseRes.body.data.status, 'paused');

      const resumeRes = await ctx.request(`/api/outreach/sequences/${sequenceId}/resume`, {
        method: 'POST',
      });
      assert.equal(resumeRes.status, 200);
      assert.equal(resumeRes.body.data.status, 'approved');
    });

    it('dispatches Step 1 email via mock boundary, records sent event, and advances to step 2', async () => {
      // Create sequence with real steps for lead-3
      const lead3: LeadDTO = {
        id: 'lead-3',
        name: 'Sophia Chen',
        title: 'Chief Commercial Officer',
        company: 'FinSphere Payments',
        companyDomain: 'finsphere.co',
        avatar: '',
        email: 's.chen@finsphere.co',
        linkedin: '',
        location: '',
        industry: 'FinTech & Payments',
        companySize: '500 - 1,000',
        score: 92,
        tier: 'high',
        status: 'New',
        dealValue: 92000,
        triggers: ['Hiring Head of RevOps'],
        notes: '',
        lastActive: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const drafts = await emailGeneratorService.generateSequence(lead3);
      const seq = sequenceQueueService.createSequence('lead-3', 'camp-1', drafts.steps);
      sequenceQueueService.approveSequence(seq.id);

      mockEmailProvider.clearHistory();

      // Dispatch step 1
      const sendRes = await ctx.request(`/api/outreach/sequences/${seq.id}/send-now`, {
        method: 'POST',
      });

      assert.equal(sendRes.status, 200);
      assert.ok(sendRes.body.success);
      assert.equal(sendRes.body.data.status, 'active');
      assert.equal(sendRes.body.data.currentStep, 2);

      // Verify email was sent via provider
      const history = mockEmailProvider.getHistory();
      assert.equal(history.length, 1);
      assert.equal(history[0].to, 's.chen@finsphere.co');

      // Verify lead lifecycle advanced from New -> Contacted
      const leadRes = await ctx.request('/api/leads/lead-3');
      assert.equal(leadRes.body.data.status, 'Contacted');
    });

    it('prevents sending when recipient email is in suppression list', async () => {
      // Add test suppression email
      engagementService.addToSuppressionList('suppressed-prospect@example.com', 'unsubscribed', 'test');

      // Create dummy lead with this email
      ctx.db.prepare(`
        INSERT INTO leads (id, name, title, company, company_domain, email, industry, company_size, tier, status)
        VALUES ('lead-suppressed', 'Blocked Contact', 'VP', 'BlockCo', 'block.com', 'suppressed-prospect@example.com', 'Tech', '100', 'medium', 'New')
      `).run();

      const seq = sequenceQueueService.createSequence('lead-suppressed', 'camp-1', [
        {
          stepNumber: 1,
          subject: 'Test',
          bodyHtml: '<p>Test</p>',
          bodyText: 'Test',
          personalizationEvidence: [],
        },
      ]);
      sequenceQueueService.approveSequence(seq.id);

      const sendRes = await sequenceQueueService.sendNextStep(seq.id);
      assert.equal(sendRes.success, false);
      assert.ok(sendRes.error?.includes('suppressed'));

      // Verify sequence was stopped
      const updatedSeq = sequenceQueueService.getSequenceById(seq.id);
      assert.equal(updatedSeq?.status, 'stopped_on_opt_out');
    });
  });

  describe('Workstream E: Engagement Intelligence & Webhooks', () => {
    it('ingests engagement events and prevents duplicates idempotently', async () => {
      const providerEventId = `resend-evt-${Date.now()}`;

      // First ingestion
      const res1 = await ctx.request('/api/outreach/events', {
        method: 'POST',
        body: JSON.stringify({
          leadId: 'lead-1',
          eventType: 'opened',
          providerEventId,
          sourceMetadata: { client: 'Gmail', ip: '1.2.3.4' },
        }),
      });

      assert.equal(res1.status, 200);
      assert.equal(res1.body.isDuplicate, false);
      assert.equal(res1.body.data.eventType, 'opened');

      // Duplicate ingestion
      const res2 = await ctx.request('/api/outreach/events', {
        method: 'POST',
        body: JSON.stringify({
          leadId: 'lead-1',
          eventType: 'opened',
          providerEventId,
          sourceMetadata: { client: 'Gmail', ip: '1.2.3.4' },
        }),
      });

      assert.equal(res2.status, 200);
      assert.equal(res2.body.isDuplicate, true);
    });

    it('stops sequence and marks lead Qualified on prospect reply', async () => {
      const seq = sequenceQueueService.createSequence('lead-2', 'camp-1');
      sequenceQueueService.approveSequence(seq.id);

      // Record replied event
      await engagementService.recordEvent({
        leadId: 'lead-2',
        sequenceId: seq.id,
        eventType: 'replied',
        providerEventId: `reply-${Date.now()}`,
      });

      // Verify sequence is stopped
      const updatedSeq = sequenceQueueService.getSequenceById(seq.id);
      assert.equal(updatedSeq?.status, 'stopped_on_reply');

      // Verify lead is Qualified
      const lead = ctx.db.prepare('SELECT status FROM leads WHERE id = ?').get('lead-2') as any;
      assert.equal(lead.status, 'Qualified');
    });

    it('adds email to suppression list and stops sequence on unsubscribe', async () => {
      const seq = sequenceQueueService.createSequence('lead-4', 'camp-1');
      sequenceQueueService.approveSequence(seq.id);

      // Record unsubscribed event
      await engagementService.recordEvent({
        leadId: 'lead-4',
        sequenceId: seq.id,
        eventType: 'unsubscribed',
        providerEventId: `unsub-${Date.now()}`,
      });

      // Verify sequence stopped
      const updatedSeq = sequenceQueueService.getSequenceById(seq.id);
      assert.equal(updatedSeq?.status, 'stopped_on_opt_out');

      // Verify email was added to suppression registry
      const lead = ctx.db.prepare('SELECT email, status FROM leads WHERE id = ?').get('lead-4') as any;
      assert.ok(engagementService.isSuppressed(lead.email));
      assert.equal(lead.status, 'Disqualified');
    });
  });

  describe('Workstream F: Explainable Opportunity & Conversion Scoring', () => {
    it('calculates 4-pillar explainable opportunity score with factors and evidence references', async () => {
      const scoreRes = await ctx.request('/api/opportunities/lead-1/score');

      assert.equal(scoreRes.status, 200);
      assert.ok(scoreRes.body.success);

      const score = scoreRes.body.data;
      assert.ok(score.score >= 0 && score.score <= 100);
      assert.ok(['high', 'medium', 'low'].includes(score.readinessTier));

      // 4 Pillars verification
      assert.equal(score.factors.length, 4);
      const pillars = score.factors.map((f: any) => f.pillar);
      assert.ok(pillars.includes('icp_fit'));
      assert.ok(pillars.includes('verification'));
      assert.ok(pillars.includes('engagement'));
      assert.ok(pillars.includes('deal_intent'));

      // Total weight equals 100%
      const totalWeight = score.factors.reduce((acc: number, f: any) => acc + f.weight, 0);
      assert.equal(totalWeight, 100);

      // Evidence references attached
      assert.ok(score.evidenceReferences.length > 0);
      assert.ok(score.evidenceReferences[0].title);
    });
  });

  describe('Workstream G: CRM Synchronization (HubSpot REST Boundary)', () => {
    it('returns CRM connector status with explicit mode', async () => {
      const statusRes = await ctx.request('/api/crm/status');
      assert.equal(statusRes.status, 200);
      assert.ok(statusRes.body.success);
      assert.equal(statusRes.body.data.provider, 'hubspot');
      assert.ok(['real', 'demo'].includes(statusRes.body.data.mode));
    });

    it('synchronizes a lead to HubSpot within safe test boundary and creates crm_sync_records', async () => {
      const syncRes = await ctx.request('/api/crm/sync/lead-1', {
        method: 'POST',
      });

      assert.equal(syncRes.status, 200);
      assert.ok(syncRes.body.success);
      assert.equal(syncRes.body.data.syncStatus, 'synced');
      assert.ok(syncRes.body.data.externalContactId);

      // Verify sync history endpoint
      const histRes = await ctx.request('/api/crm/leads/lead-1/records');
      assert.equal(histRes.status, 200);
      assert.ok(histRes.body.data.length >= 1);
      assert.equal(histRes.body.data[0].leadId, 'lead-1');
    });
  });

  describe('Workstream H & I: Outreach Analytics & Management APIs', () => {
    it('computes funnel counts, rates, attribution, and velocity metrics', async () => {
      const anRes = await ctx.request('/api/outreach/analytics');
      assert.equal(anRes.status, 200);
      assert.ok(anRes.body.success);

      const an = anRes.body.data;
      assert.ok(typeof an.funnel.enrolled === 'number');
      assert.ok(typeof an.rates.deliveryRate === 'number');
      assert.ok(typeof an.rates.openRate === 'number');
      assert.ok(typeof an.rates.replyRate === 'number');
      assert.ok(Array.isArray(an.attribution));
      assert.ok(an.velocity.averageDaysToFirstReply > 0);
    });

    it('manages suppression list via REST API', async () => {
      // Add
      const addRes = await ctx.request('/api/outreach/suppression', {
        method: 'POST',
        body: JSON.stringify({ email: 'compliance-test@domain.com', reason: 'manual' }),
      });
      assert.equal(addRes.status, 201);
      const addedId = addRes.body.data.id;

      // List
      const listRes = await ctx.request('/api/outreach/suppression');
      assert.equal(listRes.status, 200);
      const found = listRes.body.data.some((s: any) => s.email === 'compliance-test@domain.com');
      assert.ok(found);

      // Remove
      const delRes = await ctx.request(`/api/outreach/suppression/${addedId}`, {
        method: 'DELETE',
      });
      assert.equal(delRes.status, 200);
      assert.ok(delRes.body.success);
    });
  });
});
