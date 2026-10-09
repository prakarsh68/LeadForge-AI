import { randomUUID } from 'node:crypto';
import { getDb } from '../../db/database.js';
import type {
  SourcingPlanDTO,
  SourcingPlanConstraints,
  SelectedSourcePlanEntry,
  FilteringStageBlueprint,
  SourceCapability,
} from '../../types/index.js';
import { sourceRegistry } from './sourceConnectorRegistry.js';
import { SourceEligibilityService } from './sourceEligibilityService.js';
import { sourcingPlanEntityToDto } from '../../utils/serializers.js';

export interface PlanGenerationInput {
  name: string;
  targetIcpId?: string;
  campaignObjective: string;
  constraints?: SourcingPlanConstraints;
}

export class SourcingPlannerService {
  /**
   * Deterministic utility score calculation for a source given an ICP and constraints.
   * Formula: utility = (expectedYieldNorm * 35) + (coverageVal * 25) + (freshnessVal * 15) - (dupPenalty * 15) - (costPenalty * 10)
   */
  public static calculateSourceUtility(
    _sourceId: string,
    capabilities: SourceCapability[],
    perRecordCost: number,
    isFirstParty: boolean
  ): { utilityScore: number; rationale: string; expectedYield: number; estimatedCost: number } {
    let expectedYieldNorm = 70; // 0-100 baseline
    let coverageVal = 75;
    const freshnessVal = 85;
    let dupPenalty = 15;
    const costPenalty = Math.min(100, (perRecordCost / 0.05) * 50);

    let rationale = '';

    if (isFirstParty) {
      expectedYieldNorm = 80;
      coverageVal = 90;
      dupPenalty = 5;
      rationale = 'Zero marginal cost; highest data fidelity from verified CRM history; zero deliverability risk.';
    } else if (capabilities.includes('hiring_signals')) {
      expectedYieldNorm = 85;
      coverageVal = 80;
      rationale = 'High buying intent signal; identifies companies actively expanding target teams before contact retrieval.';
    } else if (capabilities.includes('technology_signals')) {
      expectedYieldNorm = 80;
      coverageVal = 78;
      rationale = 'Verifies target technology stack adoption; filters out incompatible architectures prior to contact resolution.';
    } else if (capabilities.includes('contact_discovery') && capabilities.includes('contact_verification')) {
      expectedYieldNorm = 90;
      coverageVal = 88;
      rationale = 'Direct executive contact retrieval with built-in deliverability verification and confidence grading.';
    } else {
      expectedYieldNorm = 75;
      coverageVal = 70;
      rationale = 'Multi-signal synthetic demo source for repeatable campaign benchmarking and verification.';
    }

    const rawUtility =
      (expectedYieldNorm * 0.35) +
      (coverageVal * 0.25) +
      (freshnessVal * 0.15) -
      (dupPenalty * 0.15) -
      (costPenalty * 0.10);

    const utilityScore = Math.max(0, Math.min(100, Math.round(rawUtility)));
    const expectedYield = Math.round(expectedYieldNorm * 0.8);
    const estimatedCost = Number((expectedYield * perRecordCost).toFixed(2));

    return {
      utilityScore,
      rationale,
      expectedYield,
      estimatedCost,
    };
  }

  public static generatePlanPreview(input: PlanGenerationInput): SourcingPlanDTO {
    const targetIcpId = input.targetIcpId || 'icp-default';
    const constraints = input.constraints || {};
    const targetYield = constraints.targetYield || 50;

    const allEntries = sourceRegistry.getAllRegistryEntries();
    const selectedSources: SelectedSourcePlanEntry[] = [];

    // Evaluate each source
    for (const entry of allEntries) {
      const eligibility = SourceEligibilityService.evaluateSource(entry.id, {
        requiredCapabilities: constraints.requiredCapabilities,
        maxCostPerRecord: constraints.maxBudget ? constraints.maxBudget / targetYield : undefined,
      });

      if (!eligibility.eligible) continue;
      if (constraints.allowedSourceIds && !constraints.allowedSourceIds.includes(entry.id)) continue;

      const isFirstParty = entry.providerType === 'first_party_crm';
      const perRecordCost = entry.costModel.perRecord || 0.00;

      const evaluation = this.calculateSourceUtility(
        entry.id,
        entry.capabilities,
        perRecordCost,
        isFirstParty
      );

      // Determine optimal role
      let role: SelectedSourcePlanEntry['role'] = 'discovery';
      if (entry.capabilities.includes('contact_discovery')) {
        role = 'contact_resolution';
      } else if (entry.capabilities.includes('hiring_signals') || entry.capabilities.includes('technology_signals')) {
        role = 'signal';
      } else if (entry.capabilities.includes('first_party_records') || entry.capabilities.includes('company_discovery')) {
        role = 'discovery';
      }

      selectedSources.push({
        sourceId: entry.id,
        sourceName: entry.name,
        role,
        priority: 0, // Assigned below after sorting
        rationale: evaluation.rationale,
        utilityScore: evaluation.utilityScore,
        estimatedCost: evaluation.estimatedCost,
        expectedYield: evaluation.expectedYield,
      });
    }

    // Sort deterministically by utilityScore DESC, then sourceId ASC
    selectedSources.sort((a, b) => b.utilityScore - a.utilityScore || a.sourceId.localeCompare(b.sourceId));
    selectedSources.forEach((s, idx) => {
      s.priority = idx + 1;
    });

    // Progressive Filtering Stages Pipeline Blueprint (Stages 1-8)
    const stagesPipeline: FilteringStageBlueprint[] = [
      {
        stageNumber: 1,
        stageName: 'Source Query Filtering',
        description: 'Execute upstream parameter filtering on industry, headcount, and geographic bounds.',
        dropOffReason: 'Excluded by upstream API constraints and query criteria.',
      },
      {
        stageNumber: 2,
        stageName: 'Identity Deduplication',
        description: 'Normalize company domains and deduplicate against existing leads and candidate pool.',
        dropOffReason: 'Matches existing lead in database or duplicate in current batch.',
      },
      {
        stageNumber: 3,
        stageName: 'Cheap Exclusions & Suppression',
        description: 'Screen company names and domains against negative keyword catalog and suppression list.',
        dropOffReason: 'Matched negative keywords (e.g. Agency, Bootstrapped) or active suppression list.',
      },
      {
        stageNumber: 4,
        stageName: 'Preliminary ICP Screening',
        description: 'Evaluate company size ranges, revenue bands, and target industry taxonomy.',
        dropOffReason: 'Company size or industry is outside target ICP parameters.',
      },
      {
        stageNumber: 5,
        stageName: 'Signal Relevance Validation',
        description: 'Verify hiring velocity, funding recency, and technology stack buying signals.',
        dropOffReason: 'No validated buying signals or signal confidence below required threshold.',
      },
      {
        stageNumber: 6,
        stageName: 'Selective Deep Research',
        description: 'Ingest company website metadata, product focus, and news triggers.',
        dropOffReason: 'Website unreachable or firmographic mismatch during deep validation.',
      },
      {
        stageNumber: 7,
        stageName: 'Contact Resolution & Deliverability',
        description: 'Identify decision-makers (VP/Director) and verify deliverability of work emails.',
        dropOffReason: 'No matching executive roles found or email verification returned undeliverable/risky.',
      },
      {
        stageNumber: 8,
        stageName: 'Deterministic ICP Qualification',
        description: 'Execute full 4-pillar explainable ICP scoring engine against surviving candidates.',
        dropOffReason: 'ICP qualification score below minimum profile threshold.',
      },
    ];

    const totalEstimatedCost = selectedSources.reduce((sum, s) => sum + s.estimatedCost, 0);

    return {
      id: `plan-${randomUUID().slice(0, 8)}`,
      name: input.name,
      targetIcpId,
      campaignObjective: input.campaignObjective,
      constraints,
      selectedSources,
      stagesPipeline,
      estimatedCost: Number(totalEstimatedCost.toFixed(2)),
      costKnown: true,
      expectedYield: targetYield,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  public static savePlan(plan: SourcingPlanDTO): SourcingPlanDTO {
    const db = getDb();
    const insert = db.prepare(`
      INSERT INTO sourcing_plans (
        id, name, target_icp_id, campaign_objective, constraints,
        selected_sources, stages_pipeline, estimated_cost, cost_known,
        expected_yield, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(
      plan.id,
      plan.name,
      plan.targetIcpId || null,
      plan.campaignObjective,
      JSON.stringify(plan.constraints),
      JSON.stringify(plan.selectedSources),
      JSON.stringify(plan.stagesPipeline),
      plan.estimatedCost,
      plan.costKnown ? 1 : 0,
      plan.expectedYield,
      plan.status,
      plan.createdAt,
      plan.updatedAt
    );

    return plan;
  }

  public static getPlan(id: string): SourcingPlanDTO | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM sourcing_plans WHERE id = ?').get(id) as any;
    return row ? sourcingPlanEntityToDto(row) : null;
  }

  public static getAllPlans(): SourcingPlanDTO[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM sourcing_plans ORDER BY created_at DESC').all() as any[];
    return rows.map(sourcingPlanEntityToDto);
  }

  public static updatePlanStatus(id: string, status: SourcingPlanDTO['status']): SourcingPlanDTO | null {
    const db = getDb();
    db.prepare('UPDATE sourcing_plans SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(status, id);
    return this.getPlan(id);
  }
}
