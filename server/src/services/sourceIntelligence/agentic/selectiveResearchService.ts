import { ragService } from '../../knowledge/ragService.js';
import { leadScoringService } from '../../leadScoringService.js';
import type { IcpProfileDTO } from '../../../types/index.js';
import type { UnifiedResolvedCandidate } from '../sourceIdentityResolutionService.js';

export interface ResearchEnrichmentResult {
  candidateId: string;
  researched: boolean;
  priorScore: number;
  newScore: number;
  evidenceAdded: string[];
  promotedToQualified: boolean;
  rationale: string;
}

export class SelectiveResearchService {
  /**
   * Selectively investigates borderline prospects using internal Knowledge Base RAG
   * and additional signal evidence before discarding.
   */
  public static async evaluateAndEnrichBorderline(
    candidate: UnifiedResolvedCandidate,
    icp: IcpProfileDTO
  ): Promise<ResearchEnrichmentResult> {
    const minThreshold = icp.minScoreThreshold || 78;

    // 1. Initial Qualification Evaluation
    const initialEval = leadScoringService.evaluateLead(
      {
        id: candidate.id,
        name: candidate.contactName,
        title: candidate.title,
        company: candidate.companyName,
        companyDomain: candidate.companyDomain,
        email: candidate.email || '',
        industry: candidate.industry || '',
        companySize: candidate.companySize || '',
        location: candidate.location || '',
        score: 0,
        tier: 'low',
        status: 'New',
        dealValue: 0,
        triggers: candidate.triggers,
        notes: '',
        lastActive: '',
        avatar: '',
        linkedin: candidate.linkedin || '',
      },
      icp
    );

    const priorScore = initialEval.overallScore;

    // If already comfortably qualified, no deep research required
    if (priorScore >= minThreshold) {
      return {
        candidateId: candidate.id,
        researched: false,
        priorScore,
        newScore: priorScore,
        evidenceAdded: [],
        promotedToQualified: true,
        rationale: `Already exceeds qualification threshold (${priorScore} >= ${minThreshold}).`,
      };
    }

    // If score is far too low (e.g. < 55) or failed negative keywords, discard with 0 research spend
    const isNegativeKeywordHit = initialEval.criteria.some(
      (c) => c.id === 'negative_keywords' && c.status === 'mismatch'
    );

    if (priorScore < 60 || isNegativeKeywordHit) {
      return {
        candidateId: candidate.id,
        researched: false,
        priorScore,
        newScore: priorScore,
        evidenceAdded: [],
        promotedToQualified: false,
        rationale: `Discarded without research: Score (${priorScore}) too far below threshold or negative keyword detected.`,
      };
    }

    // 2. Borderline candidate (60 <= priorScore < minThreshold): Trigger Selective Research
    const query = `${candidate.industry || 'Enterprise'} ${candidate.companyName} tech stack integration sales development`;
    const evidenceAdded: string[] = [];

    try {
      const ragResponse = await ragService.ask(query, { topK: 2 });
      if (ragResponse.citations.length > 0) {
        for (const citation of ragResponse.citations) {
          evidenceAdded.push(`[Collateral] ${citation.documentTitle}: ${citation.sectionTitle || 'Overview'}`);
        }
      }
    } catch {
      // Safe fallback if RAG query yields no hits
    }

    // Add inferred signal trigger if relevant collateral matched
    if (evidenceAdded.length > 0) {
      const additionalTrigger = `Verified collateral match: ${candidate.industry} strategic alignment`;
      candidate.triggers.push(additionalTrigger);
    }

    // 3. Re-evaluate score after research enrichment
    const reEval = leadScoringService.evaluateLead(
      {
        id: candidate.id,
        name: candidate.contactName,
        title: candidate.title,
        company: candidate.companyName,
        companyDomain: candidate.companyDomain,
        email: candidate.email || '',
        industry: candidate.industry || '',
        companySize: candidate.companySize || '',
        location: candidate.location || '',
        score: 0,
        tier: 'low',
        status: 'New',
        dealValue: 0,
        triggers: candidate.triggers,
        notes: evidenceAdded.join('; '),
        lastActive: '',
        avatar: '',
        linkedin: candidate.linkedin || '',
      },
      icp
    );

    const newScore = reEval.overallScore;
    const promoted = newScore >= minThreshold;

    return {
      candidateId: candidate.id,
      researched: true,
      priorScore,
      newScore,
      evidenceAdded,
      promotedToQualified: promoted,
      rationale: promoted
        ? `Borderline candidate successfully promoted to qualified (${priorScore} -> ${newScore}) via selective research.`
        : `Investigated borderline candidate (${priorScore} -> ${newScore}), but score remained below threshold (${minThreshold}).`,
    };
  }
}

export const selectiveResearchService = SelectiveResearchService;
