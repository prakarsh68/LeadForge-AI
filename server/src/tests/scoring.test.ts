import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext, type TestContext } from './testHelper.js';
import { leadScoringService } from '../services/leadScoringService.js';
import type { LeadDTO, IcpProfileDTO } from '../types/index.js';

describe('Lead Scoring Engine & Qualification API (/api/leads/:id/qualify)', () => {
  let ctx: TestContext;

  before(async () => {
    ctx = await createTestContext();
  });

  after(async () => {
    await ctx.cleanup();
  });

  const baseIcp: IcpProfileDTO = {
    id: 'icp-test-1',
    name: 'B2B SaaS Mid-Market Profile',
    description: 'Target B2B SaaS companies in growth stage',
    targetIndustries: ['Enterprise Software & Cloud', 'FinTech & Payments'],
    companySizeRanges: ['100 - 250', '250 - 500'],
    targetLocations: ['North America'],
    revenueRanges: ['$10M - $50M'],
    targetRoles: ['VP of Sales', 'Chief Commercial Officer', 'Director of Sales Ops'],
    seniorityLevels: ['VP', 'Director', 'C-Level'],
    buyingTriggers: [
      'Raised Series B',
      'Hiring 5+ Account Executives',
      'Expanding into EMEA',
    ],
    techStack: ['Salesforce', 'HubSpot', 'Outreach'],
    minScoreThreshold: 75,
    negativeKeywords: ['Freelancers', 'Crypto Gambling', 'Agency'],
    scoringWeights: {
      industry: 30,
      roleSeniority: 25,
      intentTriggers: 30,
      techStack: 15,
    },
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  test('Deterministic scoring: identical inputs produce identical scores and criteria', () => {
    const sampleLead: Partial<LeadDTO> = {
      id: 'lead-test-perfect',
      name: 'Sarah Connor',
      title: 'VP of Sales',
      company: 'TechFlow Solutions',
      industry: 'Enterprise Software & Cloud',
      companySize: '250 - 500',
      triggers: ['Raised Series B', 'Hiring 5+ Account Executives'],
      notes: 'Currently standardizing on Salesforce and Outreach for outbound automation.',
    };

    const res1 = leadScoringService.evaluateLead(sampleLead, baseIcp);
    const res2 = leadScoringService.evaluateLead(sampleLead, baseIcp);

    assert.equal(res1.overallScore, res2.overallScore);
    assert.equal(res1.tier, res2.tier);
    assert.equal(res1.criteria.length, res2.criteria.length);
    assert.equal(res1.overallScore, 100);
    assert.equal(res1.tier, 'high');
    assert.equal(res1.isQualified, true);

    // Verify all criteria are matches
    for (const c of res1.criteria) {
      assert.equal(c.status, 'match');
      assert.ok(c.pointsEarned > 0 || c.id === 'negative_keywords');
    }
  });

  test('Missing information yields no_data (0 pts) and is never treated as match', () => {
    const emptyLead: Partial<LeadDTO> = {
      id: 'lead-test-empty',
      name: 'Unknown Person',
      company: 'Stealth Startup',
      // industry, companySize, title, triggers, notes are all missing/empty
    };

    const result = leadScoringService.evaluateLead(emptyLead, baseIcp);

    assert.ok(result.overallScore <= 15, `Score should be near 0 but was ${result.overallScore}`);
    assert.equal(result.tier, 'low');
    assert.equal(result.isQualified, false);

    const indCriterion = result.criteria.find((c) => c.id === 'industry');
    assert.ok(indCriterion);
    assert.equal(indCriterion.status, 'no_data');
    assert.equal(indCriterion.pointsEarned, 0);

    const sizeCriterion = result.criteria.find((c) => c.id === 'company_size');
    assert.ok(sizeCriterion);
    assert.equal(sizeCriterion.status, 'no_data');
    assert.equal(sizeCriterion.pointsEarned, 0);

    const roleCriterion = result.criteria.find((c) => c.id === 'role_seniority');
    assert.ok(roleCriterion);
    assert.equal(roleCriterion.status, 'no_data');
    assert.equal(roleCriterion.pointsEarned, 0);

    const triggerCriterion = result.criteria.find((c) => c.id === 'buying_triggers');
    assert.ok(triggerCriterion);
    assert.equal(triggerCriterion.status, 'no_data');
    assert.equal(triggerCriterion.pointsEarned, 0);
  });

  test('Explicit mismatch gives 0 points and status mismatch', () => {
    const mismatchLead: Partial<LeadDTO> = {
      id: 'lead-test-mismatch',
      name: 'John Doe',
      title: 'Junior Copywriter',
      company: 'Local Bakery Goods',
      industry: 'Hospitality & Food',
      companySize: '1 - 10',
      triggers: ['New seasonal menu launched'],
      notes: 'Uses pen and paper.',
    };

    const result = leadScoringService.evaluateLead(mismatchLead, baseIcp);

    assert.equal(result.overallScore, 0);
    assert.equal(result.tier, 'low');
    assert.equal(result.isQualified, false);

    const indCrit = result.criteria.find((c) => c.id === 'industry');
    assert.equal(indCrit?.status, 'mismatch');
    assert.equal(indCrit?.pointsEarned, 0);

    const roleCrit = result.criteria.find((c) => c.id === 'role_seniority');
    assert.equal(roleCrit?.status, 'mismatch');
    assert.equal(roleCrit?.pointsEarned, 0);
  });

  test('Negative keyword penalty deducts points appropriately', () => {
    const leadWithExcludedKeyword: Partial<LeadDTO> = {
      id: 'lead-test-excluded',
      name: 'Bob Martin',
      title: 'VP of Sales',
      company: 'Growth Agency Partners',
      industry: 'Enterprise Software & Cloud',
      companySize: '250 - 500',
      triggers: ['Raised Series B'],
      notes: 'Full-service outbound agency helping clients scale.',
    };

    const cleanLead: Partial<LeadDTO> = {
      ...leadWithExcludedKeyword,
      company: 'Growth Tech Corp',
      notes: 'Software vendor helping clients scale.',
    };

    const cleanResult = leadScoringService.evaluateLead(cleanLead, baseIcp);
    const penalizedResult = leadScoringService.evaluateLead(leadWithExcludedKeyword, baseIcp);

    assert.ok(
      penalizedResult.overallScore < cleanResult.overallScore,
      `Penalized score (${penalizedResult.overallScore}) should be lower than clean score (${cleanResult.overallScore})`
    );

    const negCriterion = penalizedResult.criteria.find((c) => c.id === 'negative_keywords');
    assert.ok(negCriterion);
    assert.equal(negCriterion.status, 'mismatch');
  });

  test('Weight normalization handles arbitrary non-100 weights safely', () => {
    const customWeightIcp: IcpProfileDTO = {
      ...baseIcp,
      scoringWeights: {
        industry: 50,
        roleSeniority: 50,
        intentTriggers: 50,
        techStack: 50,
      },
    };

    const sampleLead: Partial<LeadDTO> = {
      id: 'lead-test-weights',
      name: 'Alex Rivera',
      title: 'VP of Sales',
      company: 'Cloud Scale Inc',
      industry: 'Enterprise Software & Cloud',
      companySize: '250 - 500',
      triggers: ['Raised Series B'],
      notes: 'Uses Salesforce and Outreach.',
    };

    const result = leadScoringService.evaluateLead(sampleLead, customWeightIcp);
    assert.ok(result.overallScore >= 0 && result.overallScore <= 100);

    const totalWeights = result.criteria
      .filter((c) => c.id !== 'negative_keywords')
      .reduce((sum, c) => sum + c.weight, 0);
    assert.equal(totalWeights, 100);
  });

  test('POST /api/leads/:id/qualify updates lead score, creates breakdown, and syncs opportunity', async () => {
    // 1. Fetch existing lead
    const getRes = await ctx.request('/api/leads/lead-1');
    assert.equal(getRes.status, 200);
    const lead = getRes.body.data;

    // 2. Qualify lead via endpoint
    const qualRes = await ctx.request(`/api/leads/${lead.id}/qualify`, {
      method: 'POST',
    });

    assert.equal(qualRes.status, 200);
    assert.equal(qualRes.body.success, true);
    assert.ok(qualRes.body.data.qualification);
    assert.ok(qualRes.body.data.lead);

    const qual = qualRes.body.data.qualification;
    assert.equal(qual.leadId, lead.id);
    assert.ok(qual.overallScore >= 0 && qual.overallScore <= 100);
    assert.ok(['high', 'medium', 'low'].includes(qual.tier));
    assert.ok(Array.isArray(qual.criteria));
    assert.ok(qual.criteria.length >= 5);
    assert.ok(qual.disclaimers.includes('not a mathematical probability of purchase'));

    // 3. Verify lead was updated in SQLite
    const verifyLeadRes = await ctx.request(`/api/leads/${lead.id}`);
    assert.equal(verifyLeadRes.status, 200);
    assert.equal(verifyLeadRes.body.data.score, qual.overallScore);
    assert.equal(verifyLeadRes.body.data.tier, qual.tier);
    assert.ok(verifyLeadRes.body.data.qualificationBreakdown);
    assert.equal(verifyLeadRes.body.data.qualificationBreakdown.overallScore, qual.overallScore);

    // 4. Verify linked opportunity confidence score was synchronized
    const oppRes = await ctx.request(`/api/opportunities/opp-${lead.id}`);
    assert.equal(oppRes.status, 200);
    assert.equal(oppRes.body.data.confidenceScore, qual.overallScore);
  });

  test('GET /api/leads/:id/qualification returns persisted qualification breakdown', async () => {
    const res = await ctx.request('/api/leads/lead-1/qualification');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.criteria);
    assert.ok(res.body.data.overallScore !== undefined);
  });

  test('POST /api/leads/:id/qualify returns 404 for non-existent lead', async () => {
    const res = await ctx.request('/api/leads/non-existent-lead-999/qualify', {
      method: 'POST',
    });
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
  });
});

