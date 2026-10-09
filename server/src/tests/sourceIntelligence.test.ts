import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext, type TestContext } from './testHelper.js';
import { sourceRegistry } from '../services/sourceIntelligence/sourceConnectorRegistry.js';
import { SignalIntelligenceService } from '../services/sourceIntelligence/signalIntelligenceService.js';
import { SourcingPlannerService } from '../services/sourceIntelligence/sourcingPlannerService.js';
import { SourceEligibilityService } from '../services/sourceIntelligence/sourceEligibilityService.js';
import { SourceIdentityResolutionService } from '../services/sourceIntelligence/sourceIdentityResolutionService.js';
import { ProgressiveFilteringService } from '../services/sourceIntelligence/progressiveFilteringService.js';
import { SourcePerformanceService } from '../services/sourceIntelligence/sourcePerformanceService.js';
import { SourcingJobRunnerService } from '../services/sourceIntelligence/sourcingJobRunnerService.js';
import type { IcpProfileDTO } from '../types/index.js';

describe('Phase 6A: Adaptive Source Intelligence Engine', () => {
  let ctx: TestContext;
  const originalEnvFlag = process.env.SOURCE_INTELLIGENCE_ENABLED;

  before(async () => {
    // Enable flag for test context
    process.env.SOURCE_INTELLIGENCE_ENABLED = 'true';
    ctx = await createTestContext();
  });

  after(async () => {
    process.env.SOURCE_INTELLIGENCE_ENABLED = originalEnvFlag;
    await ctx.cleanup();
  });

  describe('Workstream B: Source Registry & Capability Model', () => {
    it('registers all default connectors with valid capabilities and cost models', () => {
      const allConnectors = sourceRegistry.getAll();
      assert.ok(allConnectors.length >= 5, 'Should have at least 5 default connectors');

      const connectorIds = allConnectors.map((c) => c.id);
      assert.ok(connectorIds.includes('hunter'), 'Must include hunter connector');
      assert.ok(connectorIds.includes('first_party_crm'), 'Must include first_party_crm connector');
      assert.ok(connectorIds.includes('job_board_signals'), 'Must include job_board_signals connector');
      assert.ok(connectorIds.includes('tech_stack_signals'), 'Must include tech_stack_signals connector');
      assert.ok(connectorIds.includes('demo_adaptive_source'), 'Must include demo_adaptive_source connector');

      const firstParty = sourceRegistry.get('first_party_crm');
      assert.ok(firstParty);
      assert.equal(firstParty.getCostModel().perRecord, 0.00, 'First party data should have zero unit acquisition cost');
      assert.ok(firstParty.capabilities.includes('first_party_records'));
    });

    it('retrieves connectors by required capability', () => {
      const signalConnectors = sourceRegistry.getByCapability('hiring_signals');
      assert.ok(signalConnectors.length >= 2, 'Should find hiring signal connectors');
      assert.ok(signalConnectors.some((c) => c.id === 'job_board_signals'));

      const verificationConnectors = sourceRegistry.getByCapability('contact_verification');
      assert.ok(verificationConnectors.some((c) => c.id === 'hunter'));
    });

    it('performs health check on connectors and persists status', async () => {
      const status = await sourceRegistry.checkHealth('first_party_crm');
      assert.equal(status, 'healthy');

      const entry = sourceRegistry.getRegistryEntry('first_party_crm');
      assert.ok(entry);
      assert.equal(entry.healthStatus, 'healthy');
      assert.ok(entry.lastHealthCheck != null);
    });

    it('supports administrative enabling and disabling of sources', () => {
      const updated = sourceRegistry.updateEntryStatus('demo_adaptive_source', false);
      assert.ok(updated);
      assert.equal(updated.isEnabled, false);

      const restored = sourceRegistry.updateEntryStatus('demo_adaptive_source', true);
      assert.ok(restored);
      assert.equal(restored.isEnabled, true);
    });
  });

  describe('Workstream C & F: Business Signal Ingestion & Provenance', () => {
    it('ingests signals with deterministic fingerprints and prevents duplicates idempotently', () => {
      const signalData = {
        companyName: 'CloudScale Nexus',
        companyDomain: 'cloudscale.io',
        signalCategory: 'hiring' as const,
        sourceId: 'job_board_signals',
        signalText: 'Expanding SDR Team with 10 New Positions',
        structuredEvidence: { headcount: 10, role: 'SDR' },
        confidence: 0.95,
        relevanceScore: 92,
      };

      const sig1 = SignalIntelligenceService.ingestSignal(signalData);
      assert.ok(sig1.id.startsWith('sig-'));
      assert.equal(sig1.companyDomain, 'cloudscale.io');
      assert.equal(sig1.relevanceScore, 92);

      // Ingest identical signal again
      const sig2 = SignalIntelligenceService.ingestSignal(signalData);
      assert.equal(sig2.id, sig1.id, 'Idempotent ingestion must return existing signal ID');
      assert.equal(sig2.dedupFingerprint, sig1.dedupFingerprint);
    });

    it('ingests raw source observations with exact payload and provenance tracking', () => {
      const obs = SignalIntelligenceService.ingestObservation({
        sourceId: 'tech_stack_signals',
        entityType: 'company',
        entityKey: 'domain:cloudscale.io',
        companyDomain: 'cloudscale.io',
        rawPayload: { detectedTech: ['Snowflake', 'Salesforce'], version: 'v2' },
        fieldProvenance: { detectedTech: { source: 'tech_stack_signals', confidence: 95 } },
      });

      assert.ok(obs.id.startsWith('obs-'));
      assert.equal(obs.entityKey, 'domain:cloudscale.io');
      assert.equal(obs.companyDomain, 'cloudscale.io');
      assert.equal(obs.rawPayload.detectedTech[0], 'Snowflake');
    });

    it('queries signals by domain and category', () => {
      const domainSignals = SignalIntelligenceService.getSignalsByDomain('cloudscale.io');
      assert.ok(domainSignals.length >= 1, 'Should find signals for cloudscale.io');

      const hiringSignals = SignalIntelligenceService.getAllSignals('hiring');
      assert.ok(hiringSignals.length >= 1, 'Should find hiring category signals');
      assert.ok(hiringSignals.every((s) => s.signalCategory === 'hiring'));
    });
  });

  describe('Workstream D: Source Eligibility Evaluation', () => {
    it('evaluates source constraints against capabilities, health, and budget', () => {
      // First party CRM should be eligible with zero budget
      const firstPartyEval = SourceEligibilityService.evaluateSource('first_party_crm', {
        requiredCapabilities: ['company_discovery'],
        maxCostPerRecord: 0.00,
      });
      assert.equal(firstPartyEval.eligible, true);

      // Hunter should fail if budget constraint is strictly 0.00
      const hunterEval = SourceEligibilityService.evaluateSource('hunter', {
        maxCostPerRecord: 0.01, // Hunter is 0.04
      });
      assert.equal(hunterEval.eligible, false);
      assert.ok(hunterEval.reasons.some((r) => r.includes('exceeds maximum allowed cost')));
    });
  });

  describe('Workstream E: Explainable Sourcing Strategy Planner', () => {
    it('calculates deterministic utility score and rankings', () => {
      const eval1 = SourcingPlannerService.calculateSourceUtility(
        'job_board_signals',
        ['hiring_signals', 'company_discovery'],
        0.01,
        false
      );

      const eval2 = SourcingPlannerService.calculateSourceUtility(
        'job_board_signals',
        ['hiring_signals', 'company_discovery'],
        0.01,
        false
      );

      assert.equal(eval1.utilityScore, eval2.utilityScore, 'Utility calculation must be strictly deterministic');
      assert.ok(eval1.utilityScore > 0 && eval1.utilityScore <= 100);
      assert.ok(eval1.rationale.length > 10, 'Must provide human-readable explanation');
    });

    it('generates an explainable sourcing plan preview with 8-stage blueprint', () => {
      const preview = SourcingPlannerService.generatePlanPreview({
        name: 'Enterprise Outbound Q4',
        campaignObjective: 'Target accounts hiring sales reps and verify executive contacts',
        constraints: {
          targetYield: 40,
          maxBudget: 20,
        },
      });

      assert.ok(preview.id.startsWith('plan-'));
      assert.equal(preview.name, 'Enterprise Outbound Q4');
      assert.ok(preview.selectedSources.length >= 3, 'Should select top eligible sources');
      assert.ok(preview.stagesPipeline.length === 8, 'Must include all 8 progressive filtering stages');
      assert.ok(preview.estimatedCost != null && preview.estimatedCost > 0);

      // Rankings must be sequentially prioritized
      assert.equal(preview.selectedSources[0].priority, 1);
      assert.ok(preview.selectedSources[0].utilityScore >= preview.selectedSources[1].utilityScore);
    });

    it('saves and retrieves sourcing plans in the database', () => {
      const preview = SourcingPlannerService.generatePlanPreview({
        name: 'Saved Test Plan',
        campaignObjective: 'Test objective',
      });

      const saved = SourcingPlannerService.savePlan(preview);
      assert.equal(saved.id, preview.id);

      const retrieved = SourcingPlannerService.getPlan(saved.id);
      assert.ok(retrieved);
      assert.equal(retrieved.name, 'Saved Test Plan');
      assert.equal(retrieved.status, 'draft');
    });
  });

  describe('Workstream G & H: Progressive Candidate Filtering (Stages 1–8) & Identity Resolution', () => {
    it('merges cross-source fragments and detects duplicate entities', () => {
      const fragments = [
        {
          sourceId: 'job_board_signals',
          role: 'signal' as const,
          confidence: 0.95,
          companyName: 'Acme SaaS Corp',
          companyDomain: 'acmesaas.com',
          triggers: ['Hiring 4 SDRs'],
        },
        {
          sourceId: 'hunter',
          role: 'contact_resolution' as const,
          confidence: 0.98,
          companyName: 'Acme SaaS Corp, Inc.',
          companyDomain: 'https://www.acmesaas.com/',
          contactName: 'Sarah Jenkins',
          title: 'VP of Sales',
          email: 'sarah.j@acmesaas.com',
          emailVerification: 'verified' as const,
        },
      ];

      const resolved = SourceIdentityResolutionService.resolveAndMergeEntities(fragments);
      assert.equal(resolved.length, 1, 'Should resolve matching domain into a single entity');

      const entity = resolved[0];
      assert.equal(entity.companyDomain, 'acmesaas.com');
      assert.equal(entity.contactName, 'Sarah Jenkins');
      assert.equal(entity.email, 'sarah.j@acmesaas.com');
      assert.equal(entity.contributingSources.length, 2);
      assert.ok(entity.triggers.includes('Hiring 4 SDRs'));
    });

    it('executes 8-stage progressive candidate filter and tracks stage metrics and exclusions', () => {
      const testCandidates = [
        // 1. Valid high-match candidate
        {
          id: 'cand-1',
          companyName: 'CloudPeak AI',
          companyDomain: 'cloudpeak.io',
          contactName: 'James Wilson',
          title: 'VP of Sales',
          email: 'james@cloudpeak.io',
          emailVerification: 'verified' as const,
          confidenceScore: 95,
          industry: 'Enterprise Software & Cloud',
          companySize: '100 - 250',
          location: 'San Francisco, CA',
          triggers: ['Hiring 5 Account Executives', 'Raised $20M Series A'],
          sourceUrls: ['https://jobs.cloudpeak.io'],
          primarySourceId: 'job_board_signals',
          provenanceByField: {},
          conflictHistory: [],
          contributingSources: [],
        },
        // 2. Candidate with negative keyword (Agency)
        {
          id: 'cand-2',
          companyName: 'Marketing Agency Pro',
          companyDomain: 'marketingagency.com',
          contactName: 'Tom Smith',
          title: 'Founder',
          email: 'tom@marketingagency.com',
          emailVerification: 'verified' as const,
          confidenceScore: 80,
          industry: 'Advertising & Marketing',
          companySize: '10 - 20',
          triggers: ['Hiring Designer'],
          sourceUrls: [],
          primarySourceId: 'demo_adaptive_source',
          provenanceByField: {},
          conflictHistory: [],
          contributingSources: [],
        },
        // 3. Candidate with missing buying signals / triggers
        {
          id: 'cand-3',
          companyName: 'Silent Data Systems',
          companyDomain: 'silentdata.co',
          contactName: 'Robert Vance',
          title: 'Director',
          email: 'robert@silentdata.co',
          emailVerification: 'verified' as const,
          confidenceScore: 85,
          industry: 'Enterprise Software & Cloud',
          companySize: '100 - 250',
          triggers: [], // Empty triggers!
          sourceUrls: [],
          primarySourceId: 'demo_adaptive_source',
          provenanceByField: {},
          conflictHistory: [],
          contributingSources: [],
        },
        // 4. Candidate with undeliverable email
        {
          id: 'cand-4',
          companyName: 'BounceTech Systems',
          companyDomain: 'bouncetech.io',
          contactName: 'Carol Danvers',
          title: 'VP Sales',
          email: 'carol@bouncetech.io',
          emailVerification: 'undeliverable' as const,
          confidenceScore: 90,
          industry: 'Enterprise Software & Cloud',
          companySize: '100 - 250',
          triggers: ['Hiring SDRs'],
          sourceUrls: [],
          primarySourceId: 'hunter',
          provenanceByField: {},
          conflictHistory: [],
          contributingSources: [],
        },
      ];

      const icp: IcpProfileDTO = {
        id: 'icp-default',
        name: 'Enterprise Tech ICP',
        description: 'Test ICP',
        targetIndustries: ['Enterprise Software & Cloud', 'AI & Data Analytics'],
        companySizeRanges: ['50 - 100', '100 - 250', '250 - 500'],
        targetLocations: ['San Francisco, CA', 'United States'],
        revenueRanges: ['$5M - $20M ARR'],
        targetRoles: ['VP of Sales', 'Head of Sales'],
        seniorityLevels: ['VP', 'Director'],
        buyingTriggers: ['Hiring Account Executives', 'Series A'],
        techStack: ['Salesforce', 'Snowflake'],
        minScoreThreshold: 78,
        negativeKeywords: ['Agency', 'Freelancer'],
        scoringWeights: { industry: 30, roleSeniority: 25, intentTriggers: 30, techStack: 15 },
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = ProgressiveFilteringService.runPipeline(testCandidates, icp);

      assert.equal(result.totalInput, 4);
      assert.ok(result.totalSurviving >= 1, 'Valid candidate should survive all 8 gates');
      assert.equal(result.survivingCandidates[0].id, 'cand-1');

      // Check Stage 3 (Cheap Exclusions) caught the Agency
      const stage3 = result.stageMetrics['stage3_cheap_exclusions'];
      assert.ok(stage3);
      assert.ok(stage3.rejectedCount >= 1, 'Stage 3 must reject agency negative keyword');
      assert.ok(Object.keys(stage3.exclusionBreakdown).some((k) => k.toLowerCase().includes('agency')));

      // Check Stage 5 (Signal Relevance) caught candidate with no triggers
      const stage5 = result.stageMetrics['stage5_signal_relevance'];
      assert.ok(stage5);
      assert.ok(stage5.rejectedCount >= 1, 'Stage 5 must reject candidates with zero buying signals');

      // Check Stage 7 (Contact Resolution) caught undeliverable email
      const stage7 = result.stageMetrics['stage7_contact_resolution'];
      assert.ok(stage7);
      assert.ok(stage7.rejectedCount >= 1, 'Stage 7 must reject undeliverable email verification');
    });
  });

  describe('Workstream I: Source Performance Analytics & Outcome Attribution', () => {
    it('computes performance metrics and pipeline revenue attribution across sources', () => {
      const analytics = SourcePerformanceService.getAnalytics();

      assert.ok(analytics.sources.length >= 5, 'Should compute analytics for all registered sources');
      assert.ok(analytics.totals.totalEntitiesSourced >= 0);
      assert.ok(analytics.totals.totalQualified >= 0);

      // Verify each source has metrics and explainable recommendation
      for (const s of analytics.sources) {
        assert.ok(s.sourceName);
        assert.ok(s.recommendation.length > 10, 'Each source should receive an explainable recommendation');
        assert.ok(s.duplicateRatePct >= 0 && s.duplicateRatePct <= 100);
      }
    });
  });

  describe('End-to-End Execution: Sourcing Job Runner', () => {
    it('executes an approved sourcing plan, stages candidates, and records attributions', async () => {
      // 1. Create and save plan
      const preview = SourcingPlannerService.generatePlanPreview({
        name: 'Automated Runner E2E Plan',
        campaignObjective: 'Run demo sources and stage qualified leads',
        constraints: { targetYield: 10 },
      });
      SourcingPlannerService.savePlan(preview);

      // 2. Execute plan
      const job = await SourcingJobRunnerService.executePlan(preview.id);

      assert.ok(job.id.startsWith('sjob-'));
      assert.equal(job.status, 'completed');
      assert.ok(job.recordsSourced > 0, 'Should source records from selected connectors');
      assert.ok(job.recordsQualified > 0, 'Should qualify candidates through the 8 stages');
      assert.ok(Object.keys(job.stageCounts).length === 8, 'Must persist all 8 stage counts');

      // Check plan status updated
      const updatedPlan = SourcingPlannerService.getPlan(preview.id);
      assert.ok(updatedPlan);
      assert.equal(updatedPlan.status, 'completed');
    });
  });

  describe('Workstream K & Feature Isolation: REST API & Feature Flag Gating', () => {
    it('returns status from GET /api/source-intelligence/status', async () => {
      const res = await ctx.request('/api/source-intelligence/status');
      assert.equal(res.status, 200);
      assert.equal(res.body.enabled, true);
      assert.ok(res.body.sourcesCount >= 5);
      assert.ok(res.body.signalsCount >= 0);
    });

    it('returns source registry list from GET /api/source-intelligence/sources', async () => {
      const res = await ctx.request('/api/source-intelligence/sources');
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.ok(res.body.length >= 5);
    });

    it('generates plan preview via POST /api/source-intelligence/plans/preview', async () => {
      const res = await ctx.request('/api/source-intelligence/plans/preview', {
        method: 'POST',
        body: JSON.stringify({
          name: 'API Test Plan',
          campaignObjective: 'Test objective via REST API',
          constraints: { targetYield: 25 },
        }),
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.name, 'API Test Plan');
      assert.ok(res.body.selectedSources.length >= 3);
      assert.ok(res.body.stagesPipeline.length === 8);
    });

    it('returns 403 Forbidden on protected endpoints when SOURCE_INTELLIGENCE_ENABLED is false', async () => {
      // Temporarily disable flag
      process.env.SOURCE_INTELLIGENCE_ENABLED = 'false';

      try {
        const res = await ctx.request('/api/source-intelligence/plans/preview', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Disabled Test Plan',
            campaignObjective: 'Should be blocked',
          }),
        });

        assert.equal(res.status, 403, 'Should reject with 403 when feature flag is disabled');
        assert.equal(res.body.error, 'SOURCE_INTELLIGENCE_DISABLED');

        // Status endpoint should still return informative 200
        const statusRes = await ctx.request('/api/source-intelligence/status');
        assert.equal(statusRes.status, 200);
        assert.equal(statusRes.body.enabled, false);
      } finally {
        process.env.SOURCE_INTELLIGENCE_ENABLED = 'true';
      }
    });
  });
});
