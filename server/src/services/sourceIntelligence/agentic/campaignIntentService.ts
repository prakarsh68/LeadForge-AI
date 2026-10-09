import { getEmbeddingProvider } from '../../knowledge/embeddingProvider.js';
import { icpService } from '../../icpService.js';
import { SourcingPlannerService } from '../sourcingPlannerService.js';
import type {
  ParsedCampaignIntent,
  SourcingPlanDTO,
  SignalCategory,
} from '../../../types/index.js';

export class CampaignIntentService {
  /**
   * Parses natural language campaign intent into structured sourcing parameters.
   */
  public static async parseIntent(
    naturalLanguageText: string,
    targetIcpId?: string
  ): Promise<{
    parsedIntent: ParsedCampaignIntent;
    planPreview: SourcingPlanDTO;
  }> {
    const text = naturalLanguageText.trim();
    const activeIcp = targetIcpId
      ? icpService.getById(targetIcpId)
      : icpService.getActive();

    const provider = getEmbeddingProvider();
    let parsedIntent: ParsedCampaignIntent | null = null;

    if (provider.isConfigured()) {
      try {
        parsedIntent = await this.parseWithAi(text, activeIcp);
      } catch (err) {
        console.warn('[CampaignIntentService] AI interpretation failed, falling back to deterministic parser:', err);
      }
    }

    if (!parsedIntent) {
      parsedIntent = this.parseDeterministic(text, activeIcp);
    }

    // Generate sourcing plan preview using SourcingPlannerService
    const planPreview = SourcingPlannerService.generatePlanPreview({
      name: `Agentic Plan: ${text.slice(0, 45)}...`,
      targetIcpId: activeIcp?.id,
      campaignObjective: parsedIntent.campaignObjective,
      constraints: {
        maxBudget: parsedIntent.budgetLimit,
        targetYield: parsedIntent.desiredCompanyCount,
        allowedSourceIds: parsedIntent.recommendedSources.length > 0 ? parsedIntent.recommendedSources : undefined,
      },
    });

    return {
      parsedIntent,
      planPreview,
    };
  }

  private static async parseWithAi(
    text: string,
    activeIcp: any
  ): Promise<ParsedCampaignIntent | null> {
    const provider = getEmbeddingProvider();

    const systemPrompt = `You are an expert sales development operations analyst for LeadForge AI.
Parse the user's natural language campaign sourcing instruction into structured parameters.

ACTIVE ICP PROFILE:
- Target Industries: ${(activeIcp?.targetIndustries || []).join(', ')}
- Headcount Sizes: ${(activeIcp?.companySizeRanges || []).join(', ')}
- Target Roles: ${(activeIcp?.targetRoles || []).join(', ')}
- Buying Triggers: ${(activeIcp?.buyingTriggers || []).join(', ')}

SUPPORTED SOURCE PROVIDERS:
- first_party_crm: Local CRM records (zero acquisition cost)
- hunter: Hunter.io email discovery and deliverability verification
- job_board_signals: Hiring velocity and SDR/sales expansion signals
- tech_stack_signals: Cloud and telemetry infrastructure signals
- demo_adaptive_source: Synthetic multi-signal testing connector

UNSUPPORTED CAPABILITIES:
- Direct phone number dialing / mobile numbers
- B2C / consumer leads
- Scrape from forbidden social networks (e.g. Instagram, TikTok, Reddit)

Return a JSON object conforming strictly to this structure:
{
  "campaignObjective": "concise description of the objective",
  "targetGeography": "e.g. United States, India, Europe (or undefined)",
  "targetIndustries": ["Enterprise Software & Cloud", ...],
  "companySizeRanges": ["100 - 250", ...],
  "targetRoles": ["VP of Sales", ...],
  "buyingTriggers": ["Hiring Account Executives", ...],
  "signalCategories": ["hiring", "technology", "funding", ...],
  "desiredCompanyCount": 50,
  "budgetLimit": 25.0,
  "stopConditions": ["Halt when target yield reached", "Halt if budget ceiling exceeded"],
  "recommendedSources": ["first_party_crm", "job_board_signals", "hunter"],
  "unsupportedRequirements": ["Phone numbers not supported", ...]
}`;

    const raw = await provider.generateChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Instruction: "${text}"` },
    ]);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      campaignObjective: parsed.campaignObjective || text,
      targetGeography: parsed.targetGeography,
      targetIndustries: Array.isArray(parsed.targetIndustries) && parsed.targetIndustries.length > 0
        ? parsed.targetIndustries
        : (activeIcp?.targetIndustries || ['Enterprise Software & Cloud']),
      companySizeRanges: Array.isArray(parsed.companySizeRanges) && parsed.companySizeRanges.length > 0
        ? parsed.companySizeRanges
        : (activeIcp?.companySizeRanges || ['100 - 250']),
      targetRoles: Array.isArray(parsed.targetRoles) && parsed.targetRoles.length > 0
        ? parsed.targetRoles
        : (activeIcp?.targetRoles || ['VP of Sales']),
      buyingTriggers: Array.isArray(parsed.buyingTriggers) ? parsed.buyingTriggers : (activeIcp?.buyingTriggers || []),
      signalCategories: Array.isArray(parsed.signalCategories) ? parsed.signalCategories : ['hiring'],
      desiredCompanyCount: typeof parsed.desiredCompanyCount === 'number' ? parsed.desiredCompanyCount : 25,
      budgetLimit: typeof parsed.budgetLimit === 'number' ? parsed.budgetLimit : 50.0,
      stopConditions: Array.isArray(parsed.stopConditions) ? parsed.stopConditions : ['Halt when target yield reached'],
      recommendedSources: Array.isArray(parsed.recommendedSources) ? parsed.recommendedSources : ['first_party_crm', 'job_board_signals', 'hunter'],
      unsupportedRequirements: Array.isArray(parsed.unsupportedRequirements) ? parsed.unsupportedRequirements : [],
      interpretationMode: 'llm_parsed',
    };
  }

  public static parseDeterministic(
    text: string,
    activeIcp: any
  ): ParsedCampaignIntent {
    const textLower = text.toLowerCase();

    // 1. Extract Desired Count
    let desiredCount = 25;
    const countMatch = textLower.match(/(?:find|source|get|acquire|target|discover)\s+(\d+)/i) ||
      textLower.match(/\b(\d+)\s+(?:companies|leads|prospects|accounts|startups)\b/i);
    if (countMatch && countMatch[1]) {
      const parsed = parseInt(countMatch[1], 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 500) {
        desiredCount = parsed;
      }
    }

    // 2. Extract Budget Limit
    let budgetLimit = 50.0;
    const budgetMatch = textLower.match(/\$(\d+(?:\.\d+)?)/) ||
      textLower.match(/(?:budget|cap|spend)\s*(?:of|under|limit)?\s*\$?(\d+(?:\.\d+)?)/i);
    if (budgetMatch && budgetMatch[1]) {
      const parsed = parseFloat(budgetMatch[1]);
      if (!isNaN(parsed) && parsed > 0) {
        budgetLimit = parsed;
      }
    }

    // 3. Extract Geography
    let targetGeography: string | undefined = undefined;
    if (textLower.includes('india')) targetGeography = 'India';
    else if (textLower.includes('united states') || textLower.includes('us') || textLower.includes('usa')) targetGeography = 'United States';
    else if (textLower.includes('europe') || textLower.includes('uk')) targetGeography = 'Europe';

    // 4. Extract Industries
    const targetIndustries: string[] = [];
    if (textLower.includes('fintech') || textLower.includes('payments')) targetIndustries.push('FinTech & Payments');
    if (textLower.includes('software') || textLower.includes('saas') || textLower.includes('cloud')) targetIndustries.push('Enterprise Software & Cloud');
    if (textLower.includes('ai') || textLower.includes('analytics') || textLower.includes('data')) targetIndustries.push('AI & Data Analytics');
    if (textLower.includes('security') || textLower.includes('cyber')) targetIndustries.push('Cybersecurity');
    if (targetIndustries.length === 0 && activeIcp?.targetIndustries) {
      targetIndustries.push(...activeIcp.targetIndustries);
    }
    if (targetIndustries.length === 0) {
      targetIndustries.push('Enterprise Software & Cloud');
    }

    // 5. Extract Roles
    const targetRoles: string[] = [];
    if (textLower.includes('sales') || textLower.includes('revenue')) targetRoles.push('VP of Sales', 'Chief Revenue Officer');
    if (textLower.includes('security') || textLower.includes('ciso')) targetRoles.push('Chief Information Security Officer', 'Head of Security');
    if (textLower.includes('growth') || textLower.includes('marketing')) targetRoles.push('Head of Growth', 'VP of Marketing');
    if (targetRoles.length === 0 && activeIcp?.targetRoles) {
      targetRoles.push(...activeIcp.targetRoles);
    }
    if (targetRoles.length === 0) {
      targetRoles.push('VP of Sales');
    }

    // 6. Extract Signal Categories
    const signalCategories: SignalCategory[] = [];
    if (textLower.includes('hiring') || textLower.includes('team') || textLower.includes('recruiting')) signalCategories.push('hiring');
    if (textLower.includes('tech') || textLower.includes('stack') || textLower.includes('infrastructure')) signalCategories.push('technology');
    if (textLower.includes('funding') || textLower.includes('series') || textLower.includes('venture')) signalCategories.push('funding');
    if (textLower.includes('expansion') || textLower.includes('new office')) signalCategories.push('expansion');
    if (signalCategories.length === 0) signalCategories.push('hiring');

    // 7. Check for unsupported requirements
    const unsupportedRequirements: string[] = [];
    if (textLower.includes('phone') || textLower.includes('mobile') || textLower.includes('call')) {
      unsupportedRequirements.push('Phone number discovery is not supported; system prioritizes deliverable verified email addresses.');
    }
    if (textLower.includes('tiktok') || textLower.includes('instagram') || textLower.includes('b2c')) {
      unsupportedRequirements.push('B2C social channels are unsupported; system exclusively monitors B2B enterprise sources.');
    }

    const recommendedSources = ['first_party_crm', 'job_board_signals', 'demo_adaptive_source'];
    if (process.env.HUNTER_API_KEY) {
      recommendedSources.push('hunter');
    }

    return {
      campaignObjective: text,
      targetGeography,
      targetIndustries,
      companySizeRanges: activeIcp?.companySizeRanges || ['100 - 250'],
      targetRoles,
      buyingTriggers: activeIcp?.buyingTriggers || ['Hiring Account Executives', 'Raised Series A'],
      signalCategories,
      desiredCompanyCount: desiredCount,
      budgetLimit,
      stopConditions: [
        `Halt when qualified lead yield reaches ${desiredCount}`,
        `Halt if total provider cost reaches $${budgetLimit.toFixed(2)}`,
      ],
      recommendedSources,
      unsupportedRequirements,
      interpretationMode: 'deterministic_fallback',
    };
  }
}

export const campaignIntentService = CampaignIntentService;
