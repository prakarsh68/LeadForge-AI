import type {
  LeadEntity,
  LeadDTO,
  IcpProfileEntity,
  IcpProfileDTO,
  CriterionEvaluation,
  QualificationResult,
  LeadScoreTier,
} from '../types/index.js';
import { deriveTierFromScore } from '../utils/validators.js';

function parseJsonArray(raw: any): string[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // ignore
    }
  }
  return [];
}

function parseJsonWeights(raw: any): {
  industry: number;
  roleSeniority: number;
  intentTriggers: number;
  techStack: number;
} {
  const defaultWeights = {
    industry: 30,
    roleSeniority: 25,
    intentTriggers: 30,
    techStack: 15,
  };

  if (!raw) return defaultWeights;
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return defaultWeights;
    }
  }

  if (typeof parsed === 'object' && parsed !== null) {
    const ind = Number(parsed.industry);
    const role = Number(parsed.roleSeniority);
    const trig = Number(parsed.intentTriggers);
    const tech = Number(parsed.techStack);

    if (!Number.isNaN(ind) && !Number.isNaN(role) && !Number.isNaN(trig) && !Number.isNaN(tech)) {
      return {
        industry: Math.max(0, ind),
        roleSeniority: Math.max(0, role),
        intentTriggers: Math.max(0, trig),
        techStack: Math.max(0, tech),
      };
    }
  }

  return defaultWeights;
}

export type LeadScoringInput = (Partial<LeadEntity> | Partial<LeadDTO>) & Record<string, any>;
export type IcpScoringInput = (Partial<IcpProfileEntity> | Partial<IcpProfileDTO>) & Record<string, any>;

export const leadScoringService = {
  evaluateLead(
    lead: LeadScoringInput,
    icp: IcpScoringInput
  ): QualificationResult {
    // 1. Extract and sanitize ICP criteria
    const targetIndustries = parseJsonArray(icp.target_industries || icp.targetIndustries);
    const companySizeRanges = parseJsonArray(icp.company_size_ranges || icp.companySizeRanges);
    const targetRoles = parseJsonArray(icp.target_roles || icp.targetRoles);
    const seniorityLevels = parseJsonArray(icp.seniority_levels || icp.seniorityLevels);
    const buyingTriggers = parseJsonArray(icp.buying_triggers || icp.buyingTriggers);
    const techStack = parseJsonArray(icp.tech_stack || icp.techStack);
    const negativeKeywords = parseJsonArray(icp.negative_keywords || icp.negativeKeywords);
    const minThreshold = Number(icp.min_score_threshold ?? icp.minScoreThreshold ?? 78);

    // 2. Safe weight normalization
    const rawWeights = parseJsonWeights(icp.scoring_weights || icp.scoringWeights);
    const totalRaw = rawWeights.industry + rawWeights.roleSeniority + rawWeights.intentTriggers + rawWeights.techStack;
    const normFactor = totalRaw > 0 ? 100 / totalRaw : 1;

    // Split industry weight into Industry (65%) and Company Size (35%)
    const normIndustryFirmographics = rawWeights.industry * normFactor;
    const weightIndustry = Math.round(normIndustryFirmographics * 0.65);
    const weightCompanySize = Math.round(normIndustryFirmographics * 0.35);
    const weightRoleSeniority = Math.round(rawWeights.roleSeniority * normFactor);
    const weightIntentTriggers = Math.round(rawWeights.intentTriggers * normFactor);
    // Allocate remainder to tech stack so sum is exactly 100
    const weightTechStack = Math.max(
      5,
      100 - (weightIndustry + weightCompanySize + weightRoleSeniority + weightIntentTriggers)
    );

    // Extract lead attributes
    const leadIndustry = (lead.industry || '').trim();
    const leadCompanySize = (lead.company_size || lead.companySize || '').trim();
    const leadTitle = (lead.title || '').trim();
    const leadTriggers = parseJsonArray(lead.triggers);
    const leadNotes = (lead.notes || '').trim();
    const leadCompany = (lead.company || '').trim();

    const criteria: CriterionEvaluation[] = [];
    const summaryReasons: string[] = [];

    // ==========================================
    // CRITERION 1: Target Industry Alignment
    // ==========================================
    if (!leadIndustry) {
      criteria.push({
        id: 'industry',
        name: 'Target Industry Alignment',
        weight: weightIndustry,
        pointsEarned: 0,
        status: 'no_data',
        evidence: 'Industry field missing on lead record',
        targetCriteria: targetIndustries.length > 0 ? targetIndustries.join(', ') : 'No industry restriction',
        reason: 'No industry specified. Missing data cannot be credited.',
      });
      summaryReasons.push('Industry information is missing.');
    } else if (targetIndustries.length === 0) {
      criteria.push({
        id: 'industry',
        name: 'Target Industry Alignment',
        weight: weightIndustry,
        pointsEarned: weightIndustry,
        status: 'match',
        evidence: leadIndustry,
        targetCriteria: 'All industries acceptable in active ICP',
        reason: 'Active ICP does not restrict industries; full credit applied.',
      });
    } else {
      const exactMatch = targetIndustries.some(
        (target) => target.toLowerCase() === leadIndustry.toLowerCase()
      );

      if (exactMatch) {
        criteria.push({
          id: 'industry',
          name: 'Target Industry Alignment',
          weight: weightIndustry,
          pointsEarned: weightIndustry,
          status: 'match',
          evidence: leadIndustry,
          targetCriteria: targetIndustries.join(', '),
          reason: `Exact vertical match with target ICP: "${leadIndustry}".`,
        });
        summaryReasons.push(`Vertical "${leadIndustry}" aligns with ICP focus.`);
      } else {
        // Check partial word overlap
        const leadTokens = leadIndustry.toLowerCase().split(/[\s&,/]+/);
        const hasKeywordMatch = targetIndustries.some((target) => {
          const targetLower = target.toLowerCase();
          return leadTokens.some((token) => token.length > 3 && targetLower.includes(token));
        });

        if (hasKeywordMatch) {
          const points = Math.round(weightIndustry * 0.6);
          criteria.push({
            id: 'industry',
            name: 'Target Industry Alignment',
            weight: weightIndustry,
            pointsEarned: points,
            status: 'partial',
            evidence: leadIndustry,
            targetCriteria: targetIndustries.join(', '),
            reason: `Industry "${leadIndustry}" is adjacent to target verticals.`,
          });
          summaryReasons.push(`Industry "${leadIndustry}" partially matches target market.`);
        } else {
          criteria.push({
            id: 'industry',
            name: 'Target Industry Alignment',
            weight: weightIndustry,
            pointsEarned: 0,
            status: 'mismatch',
            evidence: leadIndustry,
            targetCriteria: targetIndustries.join(', '),
            reason: `Industry "${leadIndustry}" is not among target verticals.`,
          });
          summaryReasons.push(`Vertical "${leadIndustry}" is outside targeted sectors.`);
        }
      }
    }

    // ==========================================
    // CRITERION 2: Company Size & Headcount
    // ==========================================
    if (!leadCompanySize) {
      criteria.push({
        id: 'company_size',
        name: 'Company Headcount & Scale',
        weight: weightCompanySize,
        pointsEarned: 0,
        status: 'no_data',
        evidence: 'Headcount size not recorded',
        targetCriteria: companySizeRanges.length > 0 ? companySizeRanges.join(', ') : 'Any company size',
        reason: 'Headcount metrics unavailable. Cannot assess firmographic scale.',
      });
      summaryReasons.push('Company size unknown.');
    } else if (companySizeRanges.length === 0) {
      criteria.push({
        id: 'company_size',
        name: 'Company Headcount & Scale',
        weight: weightCompanySize,
        pointsEarned: weightCompanySize,
        status: 'match',
        evidence: leadCompanySize,
        targetCriteria: 'All company sizes permitted',
        reason: 'Active ICP permits all headcount bands; full credit applied.',
      });
    } else {
      const exactSizeMatch = companySizeRanges.some(
        (size) => size.toLowerCase() === leadCompanySize.toLowerCase()
      );

      if (exactSizeMatch) {
        criteria.push({
          id: 'company_size',
          name: 'Company Headcount & Scale',
          weight: weightCompanySize,
          pointsEarned: weightCompanySize,
          status: 'match',
          evidence: `${leadCompanySize} employees`,
          targetCriteria: companySizeRanges.join(', '),
          reason: `Headcount tier (${leadCompanySize}) matches ideal corporate size.`,
        });
        summaryReasons.push(`Headcount tier (${leadCompanySize}) matches ideal company size.`);
      } else {
        criteria.push({
          id: 'company_size',
          name: 'Company Headcount & Scale',
          weight: weightCompanySize,
          pointsEarned: 0,
          status: 'mismatch',
          evidence: `${leadCompanySize} employees`,
          targetCriteria: companySizeRanges.join(', '),
          reason: `Headcount (${leadCompanySize}) is outside target ranges.`,
        });
        summaryReasons.push(`Company size (${leadCompanySize}) deviates from target range.`);
      }
    }

    // ==========================================
    // CRITERION 3: Decision-Maker Role & Seniority
    // ==========================================
    if (!leadTitle) {
      criteria.push({
        id: 'role_seniority',
        name: 'Decision-Maker Role & Seniority',
        weight: weightRoleSeniority,
        pointsEarned: 0,
        status: 'no_data',
        evidence: 'Job title not provided',
        targetCriteria: targetRoles.length > 0 ? targetRoles.join(', ') : 'Any decision-maker',
        reason: 'Contact title missing. Cannot verify buying authority.',
      });
      summaryReasons.push('Job title is missing on lead.');
    } else {
      const titleLower = leadTitle.toLowerCase();

      // Check seniority matches
      const seniorityMatches = seniorityLevels.filter((lvl) => {
        const lvlLower = lvl.toLowerCase();
        if (lvlLower.includes('c-level')) {
          return /\b(chief|cxo|ceo|cro|cco|cmo|cto)\b/i.test(leadTitle);
        }
        if (lvlLower.includes('vp')) {
          return /\b(vp|vice president)\b/i.test(leadTitle);
        }
        if (lvlLower.includes('director')) {
          return titleLower.includes('director');
        }
        if (lvlLower.includes('head')) {
          return titleLower.includes('head');
        }
        return titleLower.includes(lvlLower);
      });

      // Check role function matches
      const roleMatches = targetRoles.filter((role) => {
        const roleTokens = role.toLowerCase().split(/[\s/]+/);
        return roleTokens.some((tok) => tok.length > 3 && titleLower.includes(tok));
      });

      if (seniorityMatches.length > 0 && roleMatches.length > 0) {
        criteria.push({
          id: 'role_seniority',
          name: 'Decision-Maker Role & Seniority',
          weight: weightRoleSeniority,
          pointsEarned: weightRoleSeniority,
          status: 'match',
          evidence: leadTitle,
          targetCriteria: `${seniorityLevels.join(', ')} • ${targetRoles.slice(0, 3).join(', ')}`,
          reason: `High authority title with direct functional alignment: "${leadTitle}".`,
        });
        summaryReasons.push(`Executive title "${leadTitle}" possesses required buying authority.`);
      } else if (seniorityMatches.length > 0 || roleMatches.length > 0) {
        const points = Math.round(weightRoleSeniority * 0.65);
        criteria.push({
          id: 'role_seniority',
          name: 'Decision-Maker Role & Seniority',
          weight: weightRoleSeniority,
          pointsEarned: points,
          status: 'partial',
          evidence: leadTitle,
          targetCriteria: `${seniorityLevels.join(', ')} • ${targetRoles.slice(0, 3).join(', ')}`,
          reason: seniorityMatches.length > 0
            ? `Seniority matches, but functional domain "${leadTitle}" is adjacent.`
            : `Function matches target roles, but lacks executive seniority: "${leadTitle}".`,
        });
        summaryReasons.push(`Title "${leadTitle}" represents partial persona alignment.`);
      } else {
        criteria.push({
          id: 'role_seniority',
          name: 'Decision-Maker Role & Seniority',
          weight: weightRoleSeniority,
          pointsEarned: 0,
          status: 'mismatch',
          evidence: leadTitle,
          targetCriteria: `${seniorityLevels.join(', ')} • ${targetRoles.slice(0, 3).join(', ')}`,
          reason: `Title "${leadTitle}" does not match targeted personas.`,
        });
        summaryReasons.push(`Title "${leadTitle}" is not a targeted decision-maker.`);
      }
    }

    // ==========================================
    // CRITERION 4: Buying Triggers & Intent Evidence
    // ==========================================
    if (leadTriggers.length === 0) {
      criteria.push({
        id: 'buying_triggers',
        name: 'Buying Triggers & Intent Signals',
        weight: weightIntentTriggers,
        pointsEarned: 0,
        status: 'no_data',
        evidence: 'No active intent signals recorded',
        targetCriteria: buyingTriggers.length > 0 ? buyingTriggers.join('; ') : 'Funding, hiring, or expansion signals',
        reason: 'No buying triggers detected. Cannot confirm near-term purchase readiness.',
      });
      summaryReasons.push('No recent buying signals or funding events detected.');
    } else {
      // Analyze triggers for intent keywords: funding, hiring, tech migration, territory expansion
      const intentKeywords = [
        'series', 'raised', 'funding', 'round', 'hiring', 'recruiting',
        'sales rep', 'sdr', 'migrated', 'expansion', 'scaling'
      ];

      const detectedSignals = leadTriggers.filter((trig) => {
        const trigLower = trig.toLowerCase();
        const matchesIntent = intentKeywords.some((k) => trigLower.includes(k));
        const matchesIcp = buyingTriggers.some((target) => {
          const targetTokens = target.toLowerCase().split(/[\s,]+/);
          return targetTokens.some((tok) => tok.length > 3 && trigLower.includes(tok));
        });
        return matchesIntent || matchesIcp;
      });

      if (detectedSignals.length >= 2) {
        criteria.push({
          id: 'buying_triggers',
          name: 'Buying Triggers & Intent Signals',
          weight: weightIntentTriggers,
          pointsEarned: weightIntentTriggers,
          status: 'match',
          evidence: leadTriggers.slice(0, 2).join('; '),
          targetCriteria: buyingTriggers.join('; '),
          reason: `Multiple active intent signals confirmed (${detectedSignals.length} triggers detected).`,
        });
        summaryReasons.push(`Strong intent: ${detectedSignals.slice(0, 2).join(', ')}.`);
      } else if (detectedSignals.length === 1) {
        const points = Math.round(weightIntentTriggers * 0.7);
        criteria.push({
          id: 'buying_triggers',
          name: 'Buying Triggers & Intent Signals',
          weight: weightIntentTriggers,
          pointsEarned: points,
          status: 'partial',
          evidence: leadTriggers[0],
          targetCriteria: buyingTriggers.join('; '),
          reason: `Single buying trigger verified: "${detectedSignals[0]}".`,
        });
        summaryReasons.push(`Moderate intent: ${detectedSignals[0]}.`);
      } else {
        criteria.push({
          id: 'buying_triggers',
          name: 'Buying Triggers & Intent Signals',
          weight: weightIntentTriggers,
          pointsEarned: 0,
          status: 'mismatch',
          evidence: leadTriggers.slice(0, 2).join('; '),
          targetCriteria: buyingTriggers.join('; '),
          reason: 'Recorded events do not match targeted buying signals or growth triggers.',
        });
        summaryReasons.push('Trigger events do not reflect target buying signals.');
      }
    }

    // ==========================================
    // CRITERION 5: Technology Stack & Ecosystem
    // ==========================================
    const allText = `${leadTriggers.join(' ')} ${leadNotes} ${lead.company_domain || ''}`.toLowerCase();
    const matchedTechs = techStack.filter((tech) => {
      const techLower = tech.toLowerCase();
      return allText.includes(techLower);
    });

    if (matchedTechs.length > 0) {
      criteria.push({
        id: 'tech_stack',
        name: 'Technology Stack Alignment',
        weight: weightTechStack,
        pointsEarned: weightTechStack,
        status: 'match',
        evidence: `Compatible stack: ${matchedTechs.join(', ')}`,
        targetCriteria: techStack.join(', '),
        reason: `Verified integration with target technology stack (${matchedTechs.join(', ')}).`,
      });
      summaryReasons.push(`Tech stack matches compatible tooling (${matchedTechs.join(', ')}).`);
    } else if (techStack.length === 0) {
      criteria.push({
        id: 'tech_stack',
        name: 'Technology Stack Alignment',
        weight: weightTechStack,
        pointsEarned: weightTechStack,
        status: 'match',
        evidence: 'No stack constraint',
        targetCriteria: 'Any tech stack',
        reason: 'Active ICP does not enforce stack constraints; full credit applied.',
      });
    } else {
      criteria.push({
        id: 'tech_stack',
        name: 'Technology Stack Alignment',
        weight: weightTechStack,
        pointsEarned: 0,
        status: 'no_data',
        evidence: 'No tech stack signatures identified in current evidence',
        targetCriteria: techStack.join(', '),
        reason: 'Target tech stack signatures not verified in public telemetry.',
      });
      summaryReasons.push('Tech stack signatures unverified.');
    }

    // ==========================================
    // CRITERION 6: Negative Keyword Screening
    // ==========================================
    let penaltyPoints = 0;
    const negativeMatches = negativeKeywords.filter((neg) => {
      const negLower = neg.toLowerCase();
      return (
        leadCompany.toLowerCase().includes(negLower) ||
        leadIndustry.toLowerCase().includes(negLower) ||
        leadNotes.toLowerCase().includes(negLower)
      );
    });

    if (negativeMatches.length > 0) {
      penaltyPoints = 25;
      criteria.push({
        id: 'negative_keywords',
        name: 'Negative Keyword Exclusions',
        weight: 0,
        pointsEarned: -25,
        status: 'mismatch',
        evidence: `Matched: ${negativeMatches.join(', ')}`,
        targetCriteria: `Must exclude: ${negativeKeywords.join(', ')}`,
        reason: `Flagged by exclusion filter: "${negativeMatches.join(', ')}". Penalty applied.`,
      });
      summaryReasons.unshift(`Excluded keyword detected: "${negativeMatches[0]}".`);
    } else {
      criteria.push({
        id: 'negative_keywords',
        name: 'Negative Keyword Exclusions',
        weight: 0,
        pointsEarned: 0,
        status: 'match',
        evidence: 'Clean (no negative keyword triggers)',
        targetCriteria: negativeKeywords.length > 0 ? `Excluded: ${negativeKeywords.join(', ')}` : 'None',
        reason: 'No negative keywords or exclusion flags detected.',
      });
    }

    // ==========================================
    // SCORE SUMMATION & FINAL CALCULATION
    // ==========================================
    const totalPointsEarned = criteria.reduce(
      (sum, c) => (c.id !== 'negative_keywords' ? sum + c.pointsEarned : sum),
      0
    );
    const finalScore = Math.min(100, Math.max(0, Math.round(totalPointsEarned - penaltyPoints)));
    const tier: LeadScoreTier = deriveTierFromScore(finalScore);
    const isQualified = finalScore >= minThreshold;

    return {
      leadId: lead.id || 'unknown',
      leadName: lead.name || 'Unknown Contact',
      company: leadCompany || 'Unknown Company',
      icpProfileId: icp.id || 'icp-active',
      icpProfileName: icp.name || 'Default ICP Profile',
      overallScore: finalScore,
      tier,
      isQualified,
      threshold: minThreshold,
      criteria,
      summaryReasons,
      disclaimers:
        'ICP Fit Score evaluates firmographic and intent alignment against active criteria. It is an account qualification metric, not a mathematical probability of purchase.',
      evaluatedAt: new Date().toISOString(),
    };
  },
};
