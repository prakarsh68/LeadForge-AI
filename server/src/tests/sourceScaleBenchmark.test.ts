import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'perf_hooks';
import { createTestContext, type TestContext } from './testHelper.js';
import { ProgressiveFilteringService } from '../services/sourceIntelligence/progressiveFilteringService.js';
import type { UnifiedResolvedCandidate } from '../services/sourceIntelligence/sourceIdentityResolutionService.js';
import type { IcpProfileDTO } from '../types/index.js';

describe('Phase 6A: 100,000-Record Scale Benchmark', () => {
  let ctx: TestContext;

  before(async () => {
    ctx = await createTestContext();
  });

  after(async () => {
    await ctx.cleanup();
  });

  it('processes 100,000 candidate records through 8 progressive filtering stages efficiently', () => {
    const RECORD_COUNT = 100000;
    const initialMemory = process.memoryUsage().heapUsed;

    const icp: IcpProfileDTO = {
      id: 'icp-benchmark',
      name: 'High-Volume SaaS ICP',
      description: 'Benchmark target profile',
      targetIndustries: ['Enterprise Software & Cloud', 'AI & Data Analytics', 'FinTech & Payments'],
      companySizeRanges: ['50 - 100', '100 - 250', '250 - 500', '500 - 1,000'],
      targetLocations: ['San Francisco, CA', 'New York, NY', 'Austin, TX', 'United States'],
      revenueRanges: ['$5M - $20M ARR', '$20M - $50M ARR'],
      targetRoles: ['VP of Sales', 'Chief Revenue Officer', 'Head of Growth'],
      seniorityLevels: ['VP', 'Director', 'Head of'],
      buyingTriggers: ['Hiring Account Executives', 'Raised Series B', 'Snowflake Adoption'],
      techStack: ['Salesforce', 'HubSpot', 'Snowflake'],
      minScoreThreshold: 78,
      negativeKeywords: ['Agency', 'Freelancer', 'Bootstrapped < 10'],
      scoringWeights: { industry: 30, roleSeniority: 25, intentTriggers: 30, techStack: 15 },
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Generate 100,000 synthetic records with realistic distributions
    const genStart = performance.now();
    const candidatePool: UnifiedResolvedCandidate[] = new Array(RECORD_COUNT);

    const industries = [
      'Enterprise Software & Cloud',
      'AI & Data Analytics',
      'FinTech & Payments',
      'Healthcare',
      'Advertising & Agency',
      'Retail',
    ];
    const sizes = ['10 - 50', '50 - 100', '100 - 250', '250 - 500', '1,000+'];
    const roles = ['VP of Sales', 'Head of Growth', 'Account Executive', 'Software Engineer', 'Founder'];

    for (let i = 0; i < RECORD_COUNT; i++) {
      const isAgency = i % 15 === 2;
      const isDuplicate = i % 10 === 0 && i > 0;
      const domainIdx = isDuplicate ? i - 1 : i;

      candidatePool[i] = {
        id: `bench-cand-${i}`,
        companyName: isAgency ? `Growth Marketing Agency ${i}` : `TechCorp Nexus ${domainIdx}`,
        companyDomain: `company-${domainIdx}.io`,
        contactName: `Executive Person ${i}`,
        title: roles[i % roles.length],
        email: `exec.${i}@company-${domainIdx}.io`,
        emailVerification: i % 25 === 0 ? 'undeliverable' : 'verified',
        confidenceScore: 80 + (i % 20),
        industry: industries[i % industries.length],
        companySize: sizes[i % sizes.length],
        location: 'San Francisco, CA',
        triggers: i % 4 === 0 ? [] : ['Hiring Account Executives', 'Series B'],
        sourceUrls: [`https://company-${domainIdx}.io`],
        primarySourceId: 'demo_adaptive_source',
        provenanceByField: {},
        conflictHistory: [],
        contributingSources: [
          { sourceId: 'demo_adaptive_source', role: 'discovery', confidence: 0.9 },
        ],
      };
    }
    const genDurationMs = performance.now() - genStart;

    // 2. Execute Progressive Filtering Pipeline across all 100,000 records
    const filterStart = performance.now();
    const pipelineResult = ProgressiveFilteringService.runPipeline(candidatePool, icp, {
      minScoreThreshold: 78,
    });
    const filterDurationMs = performance.now() - filterStart;

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryUsedMb = Math.round((finalMemory - initialMemory) / (1024 * 1024));
    const throughput = Math.round((RECORD_COUNT / (filterDurationMs / 1000)));

    // 3. Assertions
    assert.equal(pipelineResult.totalInput, 100000, 'Must accept all 100,000 candidate records');
    assert.ok(pipelineResult.totalSurviving > 0, 'Qualified candidates must survive');
    assert.ok(pipelineResult.totalFilteredOut > 0, 'Unqualified and duplicate candidates must be filtered');
    assert.ok(pipelineResult.overallFilterEfficiencyPct > 0);

    // Verify all 8 stage metrics were tracked
    const stageKeys = Object.keys(pipelineResult.stageMetrics);
    assert.equal(stageKeys.length, 8, 'Must record execution metrics for all 8 stages');

    // Verify deduplication filtered out the planned duplicates
    const stage2 = pipelineResult.stageMetrics['stage2_identity_dedup'];
    assert.ok(stage2.rejectedCount >= 9000, 'Identity deduplication must reject duplicate batch domains');

    // Verify cheap exclusions caught the planned agencies
    const stage3 = pipelineResult.stageMetrics['stage3_cheap_exclusions'];
    assert.ok(stage3.rejectedCount >= 5000, 'Cheap exclusions must screen out negative keywords');

    // Verify throughput: should exceed 10,000 records/sec
    assert.ok(
      throughput >= 10000,
      `Pipeline throughput (${throughput.toLocaleString()} records/sec) must exceed 10,000 records/sec benchmark`
    );

    // Log benchmark summary for audit report
    console.log('\n--- 100,000-RECORD BENCHMARK SUMMARY ---');
    console.log(`Record Count:          ${RECORD_COUNT.toLocaleString()}`);
    console.log(`Generation Time:       ${genDurationMs.toFixed(1)} ms`);
    console.log(`Pipeline Time:         ${filterDurationMs.toFixed(1)} ms`);
    console.log(`Throughput:            ${throughput.toLocaleString()} records / sec`);
    console.log(`Heap Delta:            ${memoryUsedMb} MB`);
    console.log(`Total Filtered Out:    ${pipelineResult.totalFilteredOut.toLocaleString()} (${pipelineResult.overallFilterEfficiencyPct}%)`);
    console.log(`Total Surviving:       ${pipelineResult.totalSurviving.toLocaleString()}`);
    console.log('----------------------------------------\n');
  });
});
