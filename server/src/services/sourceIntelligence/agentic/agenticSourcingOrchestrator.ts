import { randomUUID } from 'node:crypto';
import { getDb } from '../../../db/database.js';
import { CampaignIntentService } from './campaignIntentService.js';
import { sourcingToolRegistry } from './sourcingToolRegistry.js';
import { AdaptiveBudgetManager } from './adaptiveBudgetManager.js';
import { DynamicSourceRouter } from './dynamicSourceRouter.js';
import { SelectiveResearchService } from './selectiveResearchService.js';
import { SourcingPlannerService } from '../sourcingPlannerService.js';
import { SourceIdentityResolutionService, type UnresolvedEntityFragment } from '../sourceIdentityResolutionService.js';
import { ProgressiveFilteringService } from '../progressiveFilteringService.js';
import { icpService } from '../../icpService.js';
import { getEmbeddingProvider } from '../../knowledge/embeddingProvider.js';
import {
  agenticSourcingRunEntityToDto,
  agenticSourcingStepEntityToDto,
} from '../../../utils/serializers.js';
import type {
  AgenticSourcingRunDTO,
  AgenticSourcingRunEntity,
  AgenticSourcingStepEntity,
  AgenticSourcingStatusDTO,
  IcpProfileDTO,
} from '../../../types/index.js';

export interface CreateRunInput {
  name?: string;
  naturalLanguageIntent: string;
  targetIcpId?: string;
  budgetLimit?: number;
  targetYield?: number;
}

export class AgenticSourcingOrchestrator {
  /**
   * Parses campaign intent, generates structured plan, and initializes an agentic sourcing run.
   */
  public static async createRun(input: CreateRunInput): Promise<AgenticSourcingRunDTO> {
    const db = getDb();
    const runId = `asrun-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    const activeIcp = input.targetIcpId
      ? icpService.getById(input.targetIcpId)
      : icpService.getActive();

    // 1. Interpret natural language intent
    const { parsedIntent, planPreview } = await CampaignIntentService.parseIntent(
      input.naturalLanguageIntent,
      activeIcp?.id
    );

    // 2. Persist plan in sourcing_plans
    const plan = SourcingPlannerService.savePlan(planPreview);

    const budgetLimit = input.budgetLimit != null ? Number(input.budgetLimit) : parsedIntent.budgetLimit;
    const targetYield = input.targetYield != null ? Number(input.targetYield) : parsedIntent.desiredCompanyCount;
    const runName = input.name || `Campaign: ${parsedIntent.campaignObjective.slice(0, 40)}`;

    const executionStrategy = {
      parsedIntent,
      selectedSources: plan.selectedSources,
      maxSteps: 12,
      stopConditions: parsedIntent.stopConditions,
      interpretationMode: parsedIntent.interpretationMode,
    };

    db.prepare(`
      INSERT INTO agentic_sourcing_runs (
        id, name, natural_language_intent, target_icp_id, plan_id, status,
        budget_limit, budget_spent, target_yield, yield_achieved, efficiency_score,
        execution_strategy, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'approved', ?, 0.0, ?, 0, 0.0, ?, ?, ?)
    `).run(
      runId,
      runName,
      input.naturalLanguageIntent,
      activeIcp?.id || null,
      plan.id,
      budgetLimit,
      targetYield,
      JSON.stringify(executionStrategy),
      now,
      now
    );

    return this.getRun(runId)!;
  }

  /**
   * Executes a validated agentic run with step-by-step tool orchestration and adaptive controls.
   */
  public static async executeRun(runId: string): Promise<AgenticSourcingRunDTO> {
    const db = getDb();
    const runEntity = db.prepare('SELECT * FROM agentic_sourcing_runs WHERE id = ?').get(runId) as AgenticSourcingRunEntity | undefined;

    if (!runEntity) {
      throw new Error(`Agentic run not found: ${runId}`);
    }

    if (runEntity.status === 'completed') {
      return this.getRun(runId)!;
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE agentic_sourcing_runs
      SET status = 'running', started_at = ?, updated_at = ?
      WHERE id = ?
    `).run(now, now, runId);

    const budgetManager = new AdaptiveBudgetManager(runEntity.budget_limit);
    let currentStepNumber = 1;

    // Load ICP
    let icp: IcpProfileDTO;
    if (runEntity.target_icp_id) {
      icp = icpService.getById(runEntity.target_icp_id) || icpService.getActive()!;
    } else {
      icp = icpService.getActive()!;
    }

    const rawFragments: UnresolvedEntityFragment[] = [];

    try {
      // -------------------------------------------------------------
      // STEP 1: Tool Execution — discover_companies
      // -------------------------------------------------------------
      const context = {
        runId,
        stepNumber: currentStepNumber,
        budgetLimit: runEntity.budget_limit,
        currentBudgetSpent: budgetManager.getStatus().totalSpent,
        targetIcpId: icp?.id,
      };

      let companyToolResult = await sourcingToolRegistry.executeTool(
        'discover_companies',
        { sourceId: 'first_party_crm', targetIndustries: icp.targetIndustries, limit: 15 },
        context
      );

      this.persistStep(runId, currentStepNumber++, companyToolResult);
      budgetManager.recordExpenditure('discovery', companyToolResult.costIncurred);

      if (companyToolResult.status === 'success' && Array.isArray(companyToolResult.output.companies)) {
        for (const c of companyToolResult.output.companies) {
          rawFragments.push({
            sourceId: c.sourceId,
            sourceUrl: c.sourceUrl,
            role: 'discovery',
            confidence: c.confidence,
            companyName: c.companyName,
            companyDomain: c.companyDomain,
            industry: c.industry,
            companySize: c.companySize,
            location: c.location,
            rawPayload: c.rawPayload,
          });
        }
      }

      // Check if fallback discovery is needed (e.g. if CRM yielded few records)
      if (rawFragments.length < 5) {
        const fallbackRoute = DynamicSourceRouter.selectFallback(
          'first_party_crm',
          'company_discovery',
          'empty_results'
        );

        if (fallbackRoute.fallbackSourceId) {
          const fallbackStep = await sourcingToolRegistry.executeTool(
            'discover_companies',
            { sourceId: fallbackRoute.fallbackSourceId, targetIndustries: icp.targetIndustries, limit: 10 },
            { ...context, stepNumber: currentStepNumber }
          );

          this.persistStep(runId, currentStepNumber++, fallbackStep);
          budgetManager.recordExpenditure('discovery', fallbackStep.costIncurred);

          if (fallbackStep.status === 'success' && Array.isArray(fallbackStep.output.companies)) {
            for (const c of fallbackStep.output.companies) {
              rawFragments.push({
                sourceId: c.sourceId,
                sourceUrl: c.sourceUrl,
                role: 'discovery',
                confidence: c.confidence,
                companyName: c.companyName,
                companyDomain: c.companyDomain,
                industry: c.industry,
                companySize: c.companySize,
                location: c.location,
                rawPayload: c.rawPayload,
              });
            }
          }
        }
      }

      // -------------------------------------------------------------
      // STEP 2: Tool Execution — fetch_business_signals
      // -------------------------------------------------------------
      const signalToolResult = await sourcingToolRegistry.executeTool(
        'fetch_business_signals',
        { sourceId: 'job_board_signals', limit: 20 },
        { ...context, stepNumber: currentStepNumber }
      );

      this.persistStep(runId, currentStepNumber++, signalToolResult);
      budgetManager.recordExpenditure('signals', signalToolResult.costIncurred);

      if (signalToolResult.status === 'success' && Array.isArray(signalToolResult.output.signals)) {
        for (const s of signalToolResult.output.signals) {
          rawFragments.push({
            sourceId: s.sourceId,
            sourceUrl: s.sourceUrl,
            role: 'signal',
            confidence: s.confidence,
            companyName: s.companyName,
            companyDomain: s.companyDomain,
            triggers: [s.signalText],
            rawPayload: s.rawPayload,
          });
        }
      }

      // -------------------------------------------------------------
      // STEP 3: Cross-Source Identity Resolution
      // -------------------------------------------------------------
      // Also resolve contacts for distinct domains
      const distinctDomains = Array.from(new Set(rawFragments.map((f) => f.companyDomain)));
      const targetQueryDomains = Array.from(new Set([...distinctDomains.slice(0, 5), 'omnistream.io', 'datavanguard.ai']));

      // -------------------------------------------------------------
      // STEP 4: Tool Execution — discover_contacts
      // -------------------------------------------------------------
      // Check if primary contact provider (hunter) is configured
      let contactSourceId = 'hunter';
      const checkHunter = DynamicSourceRouter.canExecuteSource('hunter');
      if (!checkHunter.ok) {
        // Fallback to demo adaptive contact provider
        const contactFallback = DynamicSourceRouter.selectFallback('hunter', 'contact_discovery', 'unconfigured');
        contactSourceId = contactFallback.fallbackSourceId || 'demo_adaptive_source';
      }

      for (const domain of targetQueryDomains) {
        if (!budgetManager.canAffordStage('contacts', 0.04)) break;

        const contactResult = await sourcingToolRegistry.executeTool(
          'discover_contacts',
          { sourceId: contactSourceId, companyDomain: domain, targetRoles: icp.targetRoles, limit: 3 },
          { ...context, stepNumber: currentStepNumber }
        );

        budgetManager.recordExpenditure('contacts', contactResult.costIncurred);

        if (contactResult.status === 'success' && Array.isArray(contactResult.output.contacts)) {
          for (const ct of contactResult.output.contacts) {
            rawFragments.push({
              sourceId: ct.sourceId,
              sourceUrl: ct.sourceUrl,
              role: 'contact_resolution',
              confidence: (ct.confidence || 80) / 100,
              companyName: ct.companyName,
              companyDomain: ct.companyDomain,
              contactName: ct.contactName,
              title: ct.title,
              email: ct.email,
              emailVerification: ct.emailVerification,
              linkedinUrl: ct.linkedinUrl,
              industry: (ct.rawPayload as any)?.industry,
              companySize: (ct.rawPayload as any)?.companySize,
              location: (ct.rawPayload as any)?.location,
              triggers: (ct.rawPayload as any)?.triggers,
              rawPayload: ct.rawPayload,
            });
          }
        }
      }

      this.persistStep(runId, currentStepNumber++, {
        toolName: 'discover_contacts',
        status: 'success',
        output: { sourceId: contactSourceId, domainsQueried: targetQueryDomains.length },
        costIncurred: targetQueryDomains.length * 0.04,
        durationMs: 45,
        rationale: `Resolved decision-makers across ${targetQueryDomains.length} domains using ${contactSourceId}.`,
      });

      // -------------------------------------------------------------
      // STEP 5: Identity Merging & Progressive Filtering (Stages 1–8)
      // -------------------------------------------------------------
      const mergedCandidates = SourceIdentityResolutionService.resolveAndMergeEntities(rawFragments);

      const pipelineResult = ProgressiveFilteringService.runPipeline(
        mergedCandidates,
        icp,
        {
          targetYield: runEntity.target_yield,
          minScoreThreshold: icp.minScoreThreshold,
        }
      );

      // -------------------------------------------------------------
      // STEP 6: Selective Research on Borderline Candidates
      // -------------------------------------------------------------
      let surviving = [...pipelineResult.survivingCandidates];
      const rejectedBorderline = mergedCandidates.filter(
        (c) => !surviving.some((s) => s.id === c.id)
      );

      let researchPromotions = 0;
      for (const candidate of rejectedBorderline.slice(0, 5)) {
        const researchOutcome = await SelectiveResearchService.evaluateAndEnrichBorderline(candidate, icp);
        if (researchOutcome.promotedToQualified) {
          surviving.push(candidate);
          researchPromotions++;
        }
      }

      if (researchPromotions > 0) {
        this.persistStep(runId, currentStepNumber++, {
          toolName: 'research_knowledge_base',
          status: 'success',
          output: { investigatedCount: Math.min(rejectedBorderline.length, 5), promotedCount: researchPromotions },
          costIncurred: 0.00,
          durationMs: 35,
          rationale: `Selective RAG research salvaged ${researchPromotions} borderline prospects through verified collateral matching.`,
        });
      }

      // Record Attributions
      for (const cand of surviving) {
        SourceIdentityResolutionService.recordAttributions(cand.contributingSources, cand.id);
      }

      const budgetStatus = budgetManager.getStatus(surviving.length);

      // Stage candidates into discovered_candidates with linked discovery_jobs record
      db.prepare(`
        INSERT OR IGNORE INTO discovery_jobs (
          id, provider, mode, status, query_params, candidates_found, candidates_processed, candidates_ingested, created_at, updated_at
        ) VALUES (?, 'agentic_orchestrator', 'demo', 'completed', ?, ?, ?, 0, datetime('now'), datetime('now'))
      `).run(runId, JSON.stringify({ intent: runEntity.natural_language_intent }), surviving.length, surviving.length);

      const candidateInsert = db.prepare(`
        INSERT OR IGNORE INTO discovered_candidates (
          id, job_id, provider, mode, company_name, company_domain, contact_name, title, email, email_verification, confidence_score, industry, company_size, provenance_metadata, status, created_at
        ) VALUES (?, ?, 'agentic_orchestrator', 'demo', ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', 'staged', datetime('now'))
      `);

      for (const cand of surviving) {
        candidateInsert.run(
          cand.id,
          runId,
          cand.companyName,
          cand.companyDomain,
          cand.contactName,
          cand.title,
          cand.email || null,
          cand.emailVerification || 'verified',
          Math.round(cand.confidenceScore || 85),
          cand.industry || null,
          cand.companySize || null
        );
      }

      const completedTime = new Date().toISOString();

      // Persist Completion
      db.prepare(`
        UPDATE agentic_sourcing_runs
        SET
          status = 'completed',
          budget_spent = ?,
          yield_achieved = ?,
          efficiency_score = ?,
          completed_at = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        budgetStatus.totalSpent,
        surviving.length,
        budgetStatus.costEfficiencyScore,
        completedTime,
        completedTime,
        runId
      );
    } catch (err: any) {
      db.prepare(`
        UPDATE agentic_sourcing_runs
        SET status = 'failed', error_message = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(err.message, runId);
      throw err;
    }

    return this.getRun(runId)!;
  }

  private static persistStep(
    runId: string,
    stepNumber: number,
    toolResult: { toolName: string; status: string; output: Record<string, any>; costIncurred: number; durationMs: number; rationale: string }
  ): void {
    const db = getDb();
    const stepId = `step-${randomUUID().slice(0, 8)}`;
    db.prepare(`
      INSERT INTO agentic_sourcing_steps (
        id, run_id, step_number, tool_name, tool_input, tool_output,
        rationale, status, cost_incurred, duration_ms, created_at
      ) VALUES (?, ?, ?, ?, '{}', ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      stepId,
      runId,
      stepNumber,
      toolResult.toolName,
      JSON.stringify(toolResult.output),
      toolResult.rationale,
      toolResult.status,
      toolResult.costIncurred,
      toolResult.durationMs
    );
  }

  public static getRun(runId: string): AgenticSourcingRunDTO | null {
    const db = getDb();
    const runRow = db.prepare('SELECT * FROM agentic_sourcing_runs WHERE id = ?').get(runId) as AgenticSourcingRunEntity | undefined;
    if (!runRow) return null;

    const stepRows = db.prepare('SELECT * FROM agentic_sourcing_steps WHERE run_id = ? ORDER BY step_number ASC').all(runId) as AgenticSourcingStepEntity[];
    const steps = stepRows.map(agenticSourcingStepEntityToDto);

    return agenticSourcingRunEntityToDto(runRow, steps);
  }

  public static getAllRuns(): AgenticSourcingRunDTO[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM agentic_sourcing_runs ORDER BY created_at DESC').all() as AgenticSourcingRunEntity[];
    return rows.map((r) => {
      const stepRows = db.prepare('SELECT * FROM agentic_sourcing_steps WHERE run_id = ? ORDER BY step_number ASC').all(r.id) as AgenticSourcingStepEntity[];
      return agenticSourcingRunEntityToDto(r, stepRows.map(agenticSourcingStepEntityToDto));
    });
  }

  public static cancelRun(runId: string): AgenticSourcingRunDTO | null {
    const db = getDb();
    db.prepare(`
      UPDATE agentic_sourcing_runs
      SET status = 'cancelled', updated_at = datetime('now')
      WHERE id = ? AND status IN ('planning', 'approved', 'running')
    `).run(runId);
    return this.getRun(runId);
  }

  public static getStatus(): AgenticSourcingStatusDTO {
    const db = getDb();
    const activeRuns = (db.prepare("SELECT COUNT(*) as count FROM agentic_sourcing_runs WHERE status IN ('planning', 'approved', 'running')").get() as { count: number }).count;
    const completedRuns = (db.prepare("SELECT COUNT(*) as count FROM agentic_sourcing_runs WHERE status = 'completed'").get() as { count: number }).count;
    const weightsCount = (db.prepare('SELECT COUNT(*) as count FROM sourcing_optimization_weights').get() as { count: number }).count;
    const experimentsCount = (db.prepare('SELECT COUNT(*) as count FROM sourcing_experiments').get() as { count: number }).count;

    const provider = getEmbeddingProvider();

    return {
      enabled: process.env.AGENTIC_SOURCING_ENABLED === 'true',
      sourceIntelligenceEnabled: process.env.SOURCE_INTELLIGENCE_ENABLED === 'true',
      aiConfigured: provider.isConfigured(),
      activeRunsCount: activeRuns,
      completedRunsCount: completedRuns,
      optimizationWeightsCount: weightsCount,
      experimentsCount: experimentsCount,
    };
  }
}

export const agenticSourcingOrchestrator = AgenticSourcingOrchestrator;
