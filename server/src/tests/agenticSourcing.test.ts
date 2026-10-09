import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext, type TestContext } from './testHelper.js';
import { sourcingToolRegistry } from '../services/sourceIntelligence/agentic/sourcingToolRegistry.js';
import { CampaignIntentService } from '../services/sourceIntelligence/agentic/campaignIntentService.js';
import { AgenticSourcingOrchestrator } from '../services/sourceIntelligence/agentic/agenticSourcingOrchestrator.js';
import { DynamicSourceRouter } from '../services/sourceIntelligence/agentic/dynamicSourceRouter.js';
import { AdaptiveBudgetManager } from '../services/sourceIntelligence/agentic/adaptiveBudgetManager.js';
import { SelectiveResearchService } from '../services/sourceIntelligence/agentic/selectiveResearchService.js';
import { SourcingOptimizationService } from '../services/sourceIntelligence/agentic/sourcingOptimizationService.js';
import { SourcingExperimentService } from '../services/sourceIntelligence/agentic/sourcingExperimentService.js';
import { icpService } from '../services/icpService.js';

describe('Phase 6B: Agentic Orchestration & Self-Optimizing Sourcing', () => {
  let ctx: TestContext;
  const originalSourceIntFlag = process.env.SOURCE_INTELLIGENCE_ENABLED;
  const originalAgenticFlag = process.env.AGENTIC_SOURCING_ENABLED;

  before(async () => {
    process.env.SOURCE_INTELLIGENCE_ENABLED = 'true';
    process.env.AGENTIC_SOURCING_ENABLED = 'true';
    ctx = await createTestContext();
  });

  after(async () => {
    process.env.SOURCE_INTELLIGENCE_ENABLED = originalSourceIntFlag;
    process.env.AGENTIC_SOURCING_ENABLED = originalAgenticFlag;
    await ctx.cleanup();
  });

  describe('Workstream B & C: Sourcing Tool Registry & Constrained Execution', () => {
    it('registers all 7 constrained sourcing tools with schema definitions', () => {
      const tools = sourcingToolRegistry.getAll();
      assert.equal(tools.length, 7, 'Must register exactly 7 constrained tools');

      const toolNames = tools.map((t) => t.name);
      assert.ok(toolNames.includes('discover_companies'));
      assert.ok(toolNames.includes('fetch_business_signals'));
      assert.ok(toolNames.includes('discover_contacts'));
      assert.ok(toolNames.includes('verify_contact_email'));
      assert.ok(toolNames.includes('research_knowledge_base'));
      assert.ok(toolNames.includes('evaluate_icp_fit'));
      assert.ok(toolNames.includes('route_fallback_source'));
    });

    it('rejects execution of unregistered tools with failed status', async () => {
      const result = await sourcingToolRegistry.executeTool('unauthorized_tool' as any, {}, {
        runId: 'test-run',
        stepNumber: 1,
        budgetLimit: 10,
        currentBudgetSpent: 0,
      });

      assert.equal(result.status, 'failed');
      assert.ok(result.output.error.includes('approved allowlist'));
    });

    it('executes discover_companies within budget context and returns structured entities', async () => {
      const result = await sourcingToolRegistry.executeTool(
        'discover_companies',
        { sourceId: 'first_party_crm', limit: 5 },
        {
          runId: 'test-run-1',
          stepNumber: 1,
          budgetLimit: 15,
          currentBudgetSpent: 0,
        }
      );

      assert.equal(result.toolName, 'discover_companies');
      assert.equal(result.status, 'success');
      assert.ok(Array.isArray(result.output.companies));
      assert.ok(result.output.companies.length > 0);
      assert.equal(result.costIncurred, 0.0, 'First party CRM has zero cost');
    });

    it('evaluates ICP fit deterministically using evaluate_icp_fit tool', async () => {
      const result = await sourcingToolRegistry.executeTool(
        'evaluate_icp_fit',
        {
          candidate: {
            name: 'Jane Doe',
            company: 'CloudMetrics Inc',
            companyDomain: 'cloudmetrics.io',
            title: 'VP of Sales',
            industry: 'Enterprise Software & Cloud',
            companySize: '100 - 250',
          },
        },
        {
          runId: 'test-run-2',
          stepNumber: 2,
          budgetLimit: 15,
          currentBudgetSpent: 0,
        }
      );

      assert.equal(result.toolName, 'evaluate_icp_fit');
      assert.equal(result.status, 'success');
      assert.ok(typeof result.output.overallScore === 'number');
      assert.ok(result.output.overallScore >= 0 && result.output.overallScore <= 100);
      assert.ok(Array.isArray(result.output.criteria));
    });
  });

  describe('Workstream D: Campaign Intent Interpretation', () => {
    it('parses natural language campaign intent into structured parameters using deterministic fallback', async () => {
      const naturalPrompt = 'Discover 20 B2B fintech startups in UK hiring sales leaders, verify emails under $10 budget';
      const { parsedIntent, planPreview } = await CampaignIntentService.parseIntent(naturalPrompt);

      assert.ok(parsedIntent);
      assert.equal(parsedIntent.desiredCompanyCount, 20);
      assert.equal(parsedIntent.budgetLimit, 10);
      assert.ok(parsedIntent.targetIndustries.includes('FinTech & Payments') || parsedIntent.targetIndustries.includes('Enterprise Software & Cloud'));
      assert.ok(parsedIntent.targetRoles.some((r) => r.toLowerCase().includes('sales')));
      assert.ok(parsedIntent.interpretationMode === 'deterministic_fallback' || parsedIntent.interpretationMode === 'llm_parsed');

      // Plan preview generated
      assert.ok(planPreview);
      assert.equal(planPreview.expectedYield, 20);
      assert.equal(planPreview.constraints.maxBudget, 10);
      assert.equal(planPreview.stagesPipeline.length, 8, 'Blueprint must have 8 stages');
    });
  });

  describe('Workstream E & G: Agentic Sourcing Orchestration & Adaptive Budget Quotas', () => {
    it('manages multi-stage budget quotas and tracks duplicate spend avoided', () => {
      const budgetManager = new AdaptiveBudgetManager(20.0);
      const plan = budgetManager.getPlan();

      assert.equal(plan.totalBudget, 20.0);
      assert.equal(plan.discoveryCap, 4.0, '20% quota for discovery');
      assert.equal(plan.signalsCap, 6.0, '30% quota for signals');
      assert.equal(plan.contactResolutionCap, 10.0, '50% quota for contacts');

      // Record spending
      budgetManager.recordExpenditure('discovery', 2.0);
      budgetManager.recordExpenditure('signals', 0.85, true); // was duplicate

      const updated = budgetManager.getStatus(5);
      assert.equal(updated.totalSpent, 2.85);
      assert.equal(updated.wastedSpendOnDuplicates, 0.85);
      assert.ok(updated.costEfficiencyScore > 0);
    });

    it('creates and executes an autonomous agentic sourcing run end-to-end', async () => {
      const run = await AgenticSourcingOrchestrator.createRun({
        naturalLanguageIntent: 'Target SaaS companies hiring account executives with $12 budget',
        budgetLimit: 12.0,
        targetYield: 15,
      });

      assert.ok(run.id);
      assert.equal(run.status, 'approved');
      assert.equal(run.budgetLimit, 12.0);

      // Execute run
      const executed = await AgenticSourcingOrchestrator.executeRun(run.id);

      assert.equal(executed.id, run.id);
      assert.equal(executed.status, 'completed');
      assert.ok(executed.yieldAchieved > 0, 'Should achieve qualified leads yield');
      assert.ok(executed.budgetSpent <= 12.0, 'Must not exceed budget limit');
      assert.ok(executed.steps.length >= 4, 'Must execute multi-tool trace');

      // Verify steps persisted in database
      const dbSteps = ctx.db.prepare('SELECT * FROM agentic_sourcing_steps WHERE run_id = ? ORDER BY step_number ASC').all(run.id) as any[];
      assert.ok(dbSteps.length >= 4);
      assert.equal(dbSteps[0].step_number, 1);
      assert.equal(dbSteps[0].tool_name, 'discover_companies');

      // Verify candidates staged in discovered_candidates
      const stagedCandidates = ctx.db.prepare('SELECT * FROM discovered_candidates WHERE job_id = ?').all(run.id) as any[];
      assert.ok(stagedCandidates.length > 0, 'Qualified candidates must be staged');
    });
  });

  describe('Workstream F: Dynamic Source Router & Fallback Handling', () => {
    it('routes to alternate source when primary source encounters rate limit or empty results', () => {
      const decision = DynamicSourceRouter.selectFallback(
        'hunter',
        'contact_discovery',
        'rate_limited'
      );

      assert.ok(decision);
      assert.equal(decision.originalSourceId, 'hunter');
      assert.notEqual(decision.fallbackSourceId, 'hunter');
      assert.ok(decision.fallbackSourceId !== null);
      assert.equal(decision.reason, 'rate_limited');
      assert.ok(decision.rationale.length > 0);
    });
  });

  describe('Workstream H: Selective RAG Deep Research for Borderline Candidates', () => {
    it('evaluates borderline prospect and skips deep research when score is too low or negative keyword matches', async () => {
      const activeIcp = icpService.getActive()!;
      const lowCandidate = {
        id: 'cand-low',
        companyName: 'Struggling Corp',
        companyDomain: 'struggling.io',
        contactName: 'Bob Intern',
        title: 'Intern',
        industry: 'Retail',
        companySize: '1 - 10',
        confidence: 0.5,
        contributingSources: ['demo_adaptive_source'],
      };

      const result = await SelectiveResearchService.evaluateAndEnrichBorderline(lowCandidate as any, activeIcp);
      assert.equal(result.researched, false, 'Should not waste budget on far-below-threshold candidates');
      assert.equal(result.promotedToQualified, false);
    });

    it('investigates borderline candidate (scores 60-77) and attempts promotion via evidence synthesis', async () => {
      const activeIcp = icpService.getActive()!;
      const borderlineCandidate = {
        id: 'cand-borderline',
        companyName: 'ScaleUp Cloud',
        companyDomain: 'scaleupcloud.io',
        contactName: 'Alex Director',
        title: 'Director of Technology',
        industry: 'Enterprise Software & Cloud',
        companySize: '100 - 250',
        confidence: 0.85,
        contributingSources: ['first_party_crm'],
      };

      const result = await SelectiveResearchService.evaluateAndEnrichBorderline(borderlineCandidate as any, activeIcp);
      assert.equal(result.candidateId, 'cand-borderline');
      assert.ok(typeof result.priorScore === 'number');
      assert.ok(typeof result.newScore === 'number');
      assert.ok(typeof result.promotedToQualified === 'boolean');
      assert.ok(result.rationale.length > 0);
    });
  });

  describe('Workstream I: Feedback-Driven Sourcing Optimization Weights', () => {
    it('recomputes empirical weights across all registered sources and reflects quality multipliers', () => {
      const weights = SourcingOptimizationService.recomputeWeights();
      assert.ok(weights.length >= 5, 'Should calculate weights for all registered connectors');

      for (const w of weights) {
        assert.ok(w.qualityMultiplier >= 0.5 && w.qualityMultiplier <= 2.5);
        assert.ok(w.empiricalYieldRate >= 0 && w.empiricalYieldRate <= 1.0);
        assert.ok(w.empiricalDuplicateRate >= 0 && w.empiricalDuplicateRate <= 1.0);
      }

      // Check specific multiplier retrieval
      const mult = SourcingOptimizationService.getEmpiricalMultiplier('hunter');
      assert.ok(typeof mult === 'number' && mult > 0);
    });
  });

  describe('Workstream J: Sourcing Strategy A/B Experimentation', () => {
    it('executes comparative A/B benchmark between Static Phase 6A and Adaptive Phase 6B', () => {
      const exp = SourcingExperimentService.runExperiment(250);

      assert.ok(exp.id);
      assert.equal(exp.status, 'completed');
      assert.equal(exp.sampleSize, 250);
      assert.equal(exp.baselineStrategy, 'deterministic_phase6a');
      assert.equal(exp.agenticStrategy, 'adaptive_agentic_phase6b');

      // Metric comparisons
      assert.ok(exp.agenticMetrics.yieldCount > exp.baselineMetrics.yieldCount, 'Agentic yield must exceed static baseline');
      assert.ok(exp.agenticMetrics.unitCost < exp.baselineMetrics.unitCost, 'Agentic unit cost must be lower than baseline');
      assert.ok(exp.agenticMetrics.efficiencyPct > exp.baselineMetrics.efficiencyPct, 'Agentic filter efficiency must be superior');

      // Uplift summary
      assert.ok(exp.upliftSummary.yieldUpliftPct > 0);
      assert.ok(exp.upliftSummary.costReductionPct > 0);
      assert.ok(exp.upliftSummary.efficiencyGainPct > 0);

      // Verify persisted in DB
      const experiments = SourcingExperimentService.getAllExperiments();
      assert.ok(experiments.some((e) => e.id === exp.id));
    });
  });

  describe('Workstream L: Feature Flag Isolation & REST API Contracts', () => {
    it('returns status from public GET /api/agentic-sourcing/status', async () => {
      const res = await ctx.request('/api/agentic-sourcing/status');
      assert.equal(res.status, 200);
      assert.equal(res.body.enabled, true);
      assert.equal(res.body.sourceIntelligenceEnabled, true);
      assert.ok(typeof res.body.activeRunsCount === 'number');
      assert.ok(typeof res.body.completedRunsCount === 'number');
      assert.ok(typeof res.body.optimizationWeightsCount === 'number');
      assert.ok(typeof res.body.experimentsCount === 'number');
    });

    it('returns 403 Forbidden on protected agentic routes when AGENTIC_SOURCING_ENABLED is false', async () => {
      process.env.AGENTIC_SOURCING_ENABLED = 'false';

      const res = await ctx.request('/api/agentic-sourcing/runs', {
        method: 'POST',
        body: JSON.stringify({ campaignIntent: 'Test intent' }),
      });

      assert.equal(res.status, 403);
      assert.equal(res.body.error, 'AGENTIC_SOURCING_DISABLED');

      // Re-enable for subsequent tests
      process.env.AGENTIC_SOURCING_ENABLED = 'true';
    });

    it('parses campaign intent via POST /api/agentic-sourcing/intent/parse', async () => {
      const res = await ctx.request('/api/agentic-sourcing/intent/parse', {
        method: 'POST',
        body: JSON.stringify({
          rawIntent: 'Discover 30 Fintech SaaS accounts hiring engineers with $15 budget',
        }),
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.desiredCompanyCount, 30);
      assert.equal(res.body.budgetLimit, 15);
      assert.ok(res.body.planPreview);
    });

    it('creates, executes, and retrieves an agentic run via REST API', async () => {
      // 1. Create run
      const createRes = await ctx.request('/api/agentic-sourcing/runs', {
        method: 'POST',
        body: JSON.stringify({
          campaignIntent: 'Target AI analytics startups in US with $10 budget',
          maxBudgetCredits: 10,
          targetYield: 10,
        }),
      });

      assert.equal(createRes.status, 201);
      const runId = createRes.body.id;
      assert.ok(runId);

      // 2. Execute run
      const execRes = await ctx.request(`/api/agentic-sourcing/runs/${runId}/execute`, {
        method: 'POST',
      });

      assert.equal(execRes.status, 200);
      assert.equal(execRes.body.status, 'completed');
      assert.ok(execRes.body.steps.length > 0);

      // 3. Retrieve run
      const getRes = await ctx.request(`/api/agentic-sourcing/runs/${runId}`);
      assert.equal(getRes.status, 200);
      assert.equal(getRes.body.id, runId);
      assert.equal(getRes.body.steps.length, execRes.body.steps.length);
    });

    it('recomputes and retrieves optimization weights via REST API', async () => {
      const recomputeRes = await ctx.request('/api/agentic-sourcing/optimization/recompute', {
        method: 'POST',
      });
      assert.equal(recomputeRes.status, 200);
      assert.ok(Array.isArray(recomputeRes.body));
      assert.ok(recomputeRes.body.length > 0);

      const getRes = await ctx.request('/api/agentic-sourcing/optimization/weights');
      assert.equal(getRes.status, 200);
      assert.equal(getRes.body.length, recomputeRes.body.length);
    });

    it('runs and retrieves A/B benchmark experiments via REST API', async () => {
      const runRes = await ctx.request('/api/agentic-sourcing/experiments/run', {
        method: 'POST',
        body: JSON.stringify({ sampleSize: 150 }),
      });

      assert.equal(runRes.status, 201);
      assert.equal(runRes.body.sampleSize, 150);
      assert.ok(runRes.body.upliftSummary);

      const getRes = await ctx.request('/api/agentic-sourcing/experiments');
      assert.equal(getRes.status, 200);
      assert.ok(Array.isArray(getRes.body));
      assert.ok(getRes.body.length > 0);
    });
  });
});
