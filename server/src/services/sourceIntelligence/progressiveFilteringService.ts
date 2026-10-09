import { performance } from 'perf_hooks';
import { getDb } from '../../db/database.js';
import type { IcpProfileDTO, StageExecutionMetric } from '../../types/index.js';
import type { UnifiedResolvedCandidate } from './sourceIdentityResolutionService.js';
import { dataQualityService } from '../dataQualityService.js';
import { leadScoringService } from '../leadScoringService.js';

export interface ProgressiveFilterOptions {
  targetYield?: number;
  maxBudget?: number;
  minScoreThreshold?: number;
  earlyStopping?: boolean;
}

export interface PipelineExecutionResult {
  survivingCandidates: UnifiedResolvedCandidate[];
  stageMetrics: Record<string, StageExecutionMetric>;
  totalInput: number;
  totalSurviving: number;
  totalFilteredOut: number;
  overallFilterEfficiencyPct: number;
}

export class ProgressiveFilteringService {
  /**
   * Executes the 8-stage progressive candidate filtering pipeline.
   */
  public static runPipeline(
    initialCandidates: UnifiedResolvedCandidate[],
    icp: IcpProfileDTO,
    options: ProgressiveFilterOptions = {}
  ): PipelineExecutionResult {
    const stageMetrics: Record<string, StageExecutionMetric> = {};
    let currentPool = [...initialCandidates];
    const totalInput = currentPool.length;

    // Cache database sets for high-throughput batch checks
    const db = getDb();
    const existingLeadsDomains = new Set<string>();
    const existingLeadsEmails = new Set<string>();

    const leadRows = db.prepare('SELECT company_domain, email FROM leads').all() as Array<{ company_domain: string; email: string }>;
    for (const r of leadRows) {
      if (r.company_domain) existingLeadsDomains.add(dataQualityService.normalizeDomain(r.company_domain));
      if (r.email) existingLeadsEmails.add(dataQualityService.normalizeEmail(r.email));
    }

    const suppressionEmails = new Set<string>();
    const supRows = db.prepare('SELECT email FROM suppression_list').all() as Array<{ email: string }>;
    for (const r of supRows) {
      if (r.email) suppressionEmails.add(dataQualityService.normalizeEmail(r.email));
    }

    const negativeKeywords = (icp.negativeKeywords || []).map((k) => k.toLowerCase().trim());
    const targetIndustries = (icp.targetIndustries || []).map((i) => i.toLowerCase().trim());
    const targetSizeRanges = (icp.companySizeRanges || []).map((s) => s.toLowerCase().trim());
    const minThreshold = options.minScoreThreshold != null ? options.minScoreThreshold : (icp.minScoreThreshold || 78);

    // ==========================================
    // STAGE 1: Source Query Filtering
    // ==========================================
    {
      const start = performance.now();
      const inputCount = currentPool.length;
      const exclusions: Record<string, number> = {};
      const surviving: UnifiedResolvedCandidate[] = [];

      for (const c of currentPool) {
        if (!c.companyDomain || c.companyDomain.trim() === '') {
          exclusions['Missing company domain'] = (exclusions['Missing company domain'] || 0) + 1;
          continue;
        }
        if (!c.companyName || c.companyName.trim() === '') {
          exclusions['Missing company name'] = (exclusions['Missing company name'] || 0) + 1;
          continue;
        }
        surviving.push(c);
      }

      currentPool = surviving;
      const durationMs = Math.round(performance.now() - start);
      const rejectedCount = inputCount - currentPool.length;
      stageMetrics['stage1_source_query'] = {
        stageNumber: 1,
        stageName: 'Source Query Filtering',
        inputCount,
        outputCount: currentPool.length,
        rejectedCount,
        efficiencyPct: inputCount > 0 ? Number(((rejectedCount / inputCount) * 100).toFixed(1)) : 0,
        exclusionBreakdown: exclusions,
        durationMs,
      };
    }

    // ==========================================
    // STAGE 2: Identity Deduplication
    // ==========================================
    {
      const start = performance.now();
      const inputCount = currentPool.length;
      const exclusions: Record<string, number> = {};
      const surviving: UnifiedResolvedCandidate[] = [];
      const seenBatchDomains = new Set<string>();

      for (const c of currentPool) {
        const dom = dataQualityService.normalizeDomain(c.companyDomain);
        if (existingLeadsDomains.has(dom)) {
          exclusions['Domain matches existing lead in CRM'] = (exclusions['Domain matches existing lead in CRM'] || 0) + 1;
          continue;
        }
        if (c.email && existingLeadsEmails.has(dataQualityService.normalizeEmail(c.email))) {
          exclusions['Email matches existing lead in CRM'] = (exclusions['Email matches existing lead in CRM'] || 0) + 1;
          continue;
        }
        if (seenBatchDomains.has(dom)) {
          exclusions['Duplicate domain in current sourcing batch'] = (exclusions['Duplicate domain in current sourcing batch'] || 0) + 1;
          continue;
        }

        seenBatchDomains.add(dom);
        surviving.push(c);
      }

      currentPool = surviving;
      const durationMs = Math.round(performance.now() - start);
      const rejectedCount = inputCount - currentPool.length;
      stageMetrics['stage2_identity_dedup'] = {
        stageNumber: 2,
        stageName: 'Identity Deduplication',
        inputCount,
        outputCount: currentPool.length,
        rejectedCount,
        efficiencyPct: inputCount > 0 ? Number(((rejectedCount / inputCount) * 100).toFixed(1)) : 0,
        exclusionBreakdown: exclusions,
        durationMs,
      };
    }

    // ==========================================
    // STAGE 3: Cheap Exclusions & Suppression
    // ==========================================
    {
      const start = performance.now();
      const inputCount = currentPool.length;
      const exclusions: Record<string, number> = {};
      const surviving: UnifiedResolvedCandidate[] = [];

      for (const c of currentPool) {
        if (c.email && suppressionEmails.has(dataQualityService.normalizeEmail(c.email))) {
          exclusions['Email present in suppression list'] = (exclusions['Email present in suppression list'] || 0) + 1;
          continue;
        }

        const nameLower = c.companyName.toLowerCase();
        const domLower = c.companyDomain.toLowerCase();
        let matchedNeg: string | null = null;

        for (const neg of negativeKeywords) {
          if (nameLower.includes(neg) || domLower.includes(neg)) {
            matchedNeg = neg;
            break;
          }
        }

        if (matchedNeg) {
          const reason = `Matched negative keyword: ${matchedNeg}`;
          exclusions[reason] = (exclusions[reason] || 0) + 1;
          continue;
        }

        surviving.push(c);
      }

      currentPool = surviving;
      const durationMs = Math.round(performance.now() - start);
      const rejectedCount = inputCount - currentPool.length;
      stageMetrics['stage3_cheap_exclusions'] = {
        stageNumber: 3,
        stageName: 'Cheap Exclusions & Suppression',
        inputCount,
        outputCount: currentPool.length,
        rejectedCount,
        efficiencyPct: inputCount > 0 ? Number(((rejectedCount / inputCount) * 100).toFixed(1)) : 0,
        exclusionBreakdown: exclusions,
        durationMs,
      };
    }

    // ==========================================
    // STAGE 4: Preliminary ICP Screening
    // ==========================================
    {
      const start = performance.now();
      const inputCount = currentPool.length;
      const exclusions: Record<string, number> = {};
      const surviving: UnifiedResolvedCandidate[] = [];

      for (const c of currentPool) {
        if (targetIndustries.length > 0 && c.industry) {
          const cIndLower = c.industry.toLowerCase().trim();
          const matchesIndustry = targetIndustries.some((ti) => cIndLower.includes(ti) || ti.includes(cIndLower));
          if (!matchesIndustry) {
            exclusions['Industry does not align with target ICP'] = (exclusions['Industry does not align with target ICP'] || 0) + 1;
            continue;
          }
        }

        if (targetSizeRanges.length > 0 && c.companySize) {
          const cSizeLower = c.companySize.toLowerCase().trim();
          const matchesSize = targetSizeRanges.some((ts) => cSizeLower === ts);
          if (!matchesSize) {
            exclusions['Company headcount outside ICP target range'] = (exclusions['Company headcount outside ICP target range'] || 0) + 1;
            continue;
          }
        }

        surviving.push(c);
      }

      currentPool = surviving;
      const durationMs = Math.round(performance.now() - start);
      const rejectedCount = inputCount - currentPool.length;
      stageMetrics['stage4_preliminary_icp'] = {
        stageNumber: 4,
        stageName: 'Preliminary ICP Screening',
        inputCount,
        outputCount: currentPool.length,
        rejectedCount,
        efficiencyPct: inputCount > 0 ? Number(((rejectedCount / inputCount) * 100).toFixed(1)) : 0,
        exclusionBreakdown: exclusions,
        durationMs,
      };
    }

    // ==========================================
    // STAGE 5: Signal Relevance Validation
    // ==========================================
    {
      const start = performance.now();
      const inputCount = currentPool.length;
      const exclusions: Record<string, number> = {};
      const surviving: UnifiedResolvedCandidate[] = [];

      for (const c of currentPool) {
        // Must exhibit at least one trigger or signal evidence
        if (!c.triggers || c.triggers.length === 0) {
          exclusions['No verified buying signals or triggers detected'] = (exclusions['No verified buying signals or triggers detected'] || 0) + 1;
          continue;
        }

        surviving.push(c);
      }

      currentPool = surviving;
      const durationMs = Math.round(performance.now() - start);
      const rejectedCount = inputCount - currentPool.length;
      stageMetrics['stage5_signal_relevance'] = {
        stageNumber: 5,
        stageName: 'Signal Relevance Validation',
        inputCount,
        outputCount: currentPool.length,
        rejectedCount,
        efficiencyPct: inputCount > 0 ? Number(((rejectedCount / inputCount) * 100).toFixed(1)) : 0,
        exclusionBreakdown: exclusions,
        durationMs,
      };
    }

    // ==========================================
    // STAGE 6: Selective Deep Research
    // ==========================================
    {
      const start = performance.now();
      const inputCount = currentPool.length;
      const exclusions: Record<string, number> = {};
      const surviving: UnifiedResolvedCandidate[] = [];

      for (const c of currentPool) {
        // Verify valid top-level domain format
        const dom = c.companyDomain;
        if (!dom.includes('.') || dom.endsWith('.') || dom.length < 4) {
          exclusions['Invalid or incomplete corporate web domain'] = (exclusions['Invalid or incomplete corporate web domain'] || 0) + 1;
          continue;
        }

        surviving.push(c);
      }

      currentPool = surviving;
      const durationMs = Math.round(performance.now() - start);
      const rejectedCount = inputCount - currentPool.length;
      stageMetrics['stage6_deep_research'] = {
        stageNumber: 6,
        stageName: 'Selective Deep Research',
        inputCount,
        outputCount: currentPool.length,
        rejectedCount,
        efficiencyPct: inputCount > 0 ? Number(((rejectedCount / inputCount) * 100).toFixed(1)) : 0,
        exclusionBreakdown: exclusions,
        durationMs,
      };
    }

    // ==========================================
    // STAGE 7: Contact Resolution & Deliverability
    // ==========================================
    {
      const start = performance.now();
      const inputCount = currentPool.length;
      const exclusions: Record<string, number> = {};
      const surviving: UnifiedResolvedCandidate[] = [];

      for (const c of currentPool) {
        if (!c.contactName || c.contactName.trim() === '') {
          exclusions['No decision-maker contact identified'] = (exclusions['No decision-maker contact identified'] || 0) + 1;
          continue;
        }

        if (c.emailVerification === 'undeliverable') {
          exclusions['Work email verified as undeliverable/bounced'] = (exclusions['Work email verified as undeliverable/bounced'] || 0) + 1;
          continue;
        }

        surviving.push(c);
      }

      currentPool = surviving;
      const durationMs = Math.round(performance.now() - start);
      const rejectedCount = inputCount - currentPool.length;
      stageMetrics['stage7_contact_resolution'] = {
        stageNumber: 7,
        stageName: 'Contact Resolution & Deliverability',
        inputCount,
        outputCount: currentPool.length,
        rejectedCount,
        efficiencyPct: inputCount > 0 ? Number(((rejectedCount / inputCount) * 100).toFixed(1)) : 0,
        exclusionBreakdown: exclusions,
        durationMs,
      };
    }

    // ==========================================
    // STAGE 8: Deterministic ICP Qualification
    // ==========================================
    {
      const start = performance.now();
      const inputCount = currentPool.length;
      const exclusions: Record<string, number> = {};
      const surviving: UnifiedResolvedCandidate[] = [];

      for (const c of currentPool) {
        const scoringEvaluation = leadScoringService.evaluateLead(
          {
            id: c.id,
            name: c.contactName,
            title: c.title,
            company: c.companyName,
            companyDomain: c.companyDomain,
            email: c.email || '',
            industry: c.industry || 'Enterprise Software & Cloud',
            companySize: c.companySize || '100 - 250',
            location: c.location || '',
            score: 0,
            tier: 'low',
            status: 'New',
            dealValue: 0,
            triggers: c.triggers,
            notes: '',
            lastActive: '',
            avatar: '',
            linkedin: c.linkedin || '',
          },
          icp
        );

        if (scoringEvaluation.overallScore < minThreshold) {
          exclusions[`ICP Score (${scoringEvaluation.overallScore}) below threshold (${minThreshold})`] =
            (exclusions[`ICP Score (${scoringEvaluation.overallScore}) below threshold (${minThreshold})`] || 0) + 1;
          continue;
        }

        surviving.push(c);
      }

      currentPool = surviving;
      const durationMs = Math.round(performance.now() - start);
      const rejectedCount = inputCount - currentPool.length;
      stageMetrics['stage8_qualification'] = {
        stageNumber: 8,
        stageName: 'Deterministic ICP Qualification',
        inputCount,
        outputCount: currentPool.length,
        rejectedCount,
        efficiencyPct: inputCount > 0 ? Number(((rejectedCount / inputCount) * 100).toFixed(1)) : 0,
        exclusionBreakdown: exclusions,
        durationMs,
      };
    }

    // Apply target yield constraint if specified
    if (options.targetYield && currentPool.length > options.targetYield) {
      currentPool = currentPool.slice(0, options.targetYield);
    }

    const totalSurviving = currentPool.length;
    const totalFilteredOut = totalInput - totalSurviving;
    const overallFilterEfficiencyPct = totalInput > 0 ? Number(((totalFilteredOut / totalInput) * 100).toFixed(1)) : 0;

    return {
      survivingCandidates: currentPool,
      stageMetrics,
      totalInput,
      totalSurviving,
      totalFilteredOut,
      overallFilterEfficiencyPct,
    };
  }
}

