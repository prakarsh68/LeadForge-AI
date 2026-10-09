import type { LeadDTO, PersonalizationEvidence } from '../../types/index.js';
import { getEmbeddingProvider } from '../knowledge/embeddingProvider.js';
import { retrievalService } from '../knowledge/retrievalService.js';

export interface GeneratedEmailStep {
  stepNumber: number;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  personalizationEvidence: PersonalizationEvidence[];
}

export interface GeneratedSequenceDraft {
  steps: GeneratedEmailStep[];
  evidenceUsed: PersonalizationEvidence[];
  generationMode: 'ai_grounded' | 'deterministic_synthesis';
}

export const emailGeneratorService = {
  async generateSequence(
    lead: LeadDTO,
    options: {
      campaignName?: string;
      targetPersona?: string;
      customInstructions?: string;
    } = {}
  ): Promise<GeneratedSequenceDraft> {
    // 1. Gather Grounding Evidence
    const evidenceList: PersonalizationEvidence[] = [];

    // Lead-level evidence: Triggers
    if (lead.triggers && lead.triggers.length > 0) {
      for (const trigger of lead.triggers.slice(0, 3)) {
        evidenceList.push({
          type: 'lead_trigger',
          title: `Observed Buying Trigger: ${trigger}`,
          excerpt: trigger,
          confidence: 0.95,
        });
      }
    }

    // Lead-level evidence: Company & Role Alignment
    evidenceList.push({
      type: 'company_data',
      title: `${lead.company} Profile`,
      excerpt: `${lead.name} is ${lead.title} at ${lead.company} (${lead.industry}, ${lead.companySize} employees, domain: ${lead.companyDomain})`,
      confidence: 1.0,
    });

    // Knowledge base collateral retrieval
    const searchQuery = `${lead.industry} ${lead.triggers?.[0] || 'sales pipeline growth'}`;
    let relevantChunks: any[] = [];
    try {
      relevantChunks = await retrievalService.search(searchQuery, { limit: 3 });
      for (const chunk of relevantChunks) {
        evidenceList.push({
          type: 'knowledge_chunk',
          title: `${chunk.documentTitle} (${chunk.category})`,
          excerpt: chunk.content.length > 250 ? `${chunk.content.substring(0, 250)}...` : chunk.content,
          confidence: chunk.similarityScore,
          sourceId: chunk.chunkId,
        });
      }
    } catch {
      // Retrieval fallback if knowledge base empty or unindexed
    }

    const provider = getEmbeddingProvider();
    const isAiConfigured = provider.isConfigured();

    if (isAiConfigured) {
      try {
        const aiDraft = await this.generateWithAi(lead, evidenceList, options);
        if (aiDraft) {
          return {
            steps: aiDraft,
            evidenceUsed: evidenceList,
            generationMode: 'ai_grounded',
          };
        }
      } catch (err) {
        console.warn('[EmailGenerator] AI generation failed, falling back to deterministic synthesis:', err);
      }
    }

    // Deterministic grounded synthesis fallback
    const deterministicSteps = this.synthesizeDeterministicSteps(lead, evidenceList, options);
    return {
      steps: deterministicSteps,
      evidenceUsed: evidenceList,
      generationMode: 'deterministic_synthesis',
    };
  },

  async generateWithAi(
    lead: LeadDTO,
    evidence: PersonalizationEvidence[],
    options: { campaignName?: string; customInstructions?: string }
  ): Promise<GeneratedEmailStep[] | null> {
    const provider = getEmbeddingProvider();

    const evidenceSummary = evidence
      .map((e, idx) => `[Evidence ${idx + 1}] (${e.type}) ${e.title}: "${e.excerpt}"`)
      .join('\n');

    const systemPrompt = `You are an elite B2B sales development strategist at LeadForge AI.
Generate a high-converting, professional, 3-step outbound email sequence for the specified lead.

CRITICAL RULES:
1. Ground your personalization STRICTLY in the provided evidence. DO NOT hallucinate prior meetings, conversations, or referrals.
2. Step 1: Initial Hook & Value Proposition — Reference their specific buying trigger or company role, present a tailored value proposition, and offer a low-friction inquiry.
3. Step 2: Follow-up & Social Proof — Reference a relevant proof point, case study, or metric from the evidence. Respectful follow-up.
4. Step 3: Breakaway / Final Permission Ask — Short, polite breakaway inquiry. Offer to close their file or reconnect at a later quarter.
5. Return ONLY a valid JSON object matching the schema below. No markdown fences around the JSON if possible, or standard \`\`\`json.

JSON SCHEMA:
{
  "steps": [
    {
      "stepNumber": 1,
      "subject": "Subject line",
      "bodyText": "Plain text body with paragraphs separated by newlines",
      "bodyHtml": "<p>HTML body with paragraphs</p>",
      "evidenceIndices": [0, 1]
    },
    {
      "stepNumber": 2,
      "subject": "Re: Subject line",
      "bodyText": "Plain text body",
      "bodyHtml": "<p>HTML body</p>",
      "evidenceIndices": [1]
    },
    {
      "stepNumber": 3,
      "subject": "Re: Subject line",
      "bodyText": "Plain text body",
      "bodyHtml": "<p>HTML body</p>",
      "evidenceIndices": [0]
    }
  ]
}`;

    const userPrompt = `LEAD DETAILS:
Name: ${lead.name}
Title: ${lead.title}
Company: ${lead.company} (${lead.companyDomain})
Industry: ${lead.industry}
Company Size: ${lead.companySize}
Triggers: ${(lead.triggers || []).join('; ')}
${options.customInstructions ? `Special Instructions: ${options.customInstructions}` : ''}

AVAILABLE GROUNDING EVIDENCE:
${evidenceSummary}

Generate the 3-step sequence now in valid JSON.`;

    const rawResponse = await provider.generateChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    // Parse JSON safely
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed.steps) || parsed.steps.length < 3) return null;

    return parsed.steps.slice(0, 3).map((s: any, idx: number) => {
      const stepEv = Array.isArray(s.evidenceIndices)
        ? s.evidenceIndices
            .map((i: number) => evidence[i])
            .filter((e: any): e is PersonalizationEvidence => Boolean(e))
        : evidence.slice(0, 2);

      const cleanHtml = s.bodyHtml || `<p>${(s.bodyText || '').replace(/\n\n/g, '</p><p>')}</p>`;
      const cleanText = s.bodyText || cleanHtml.replace(/<[^>]+>/g, '');

      return {
        stepNumber: idx + 1,
        subject: s.subject || `Personalized insights for ${lead.company}`,
        bodyHtml: cleanHtml,
        bodyText: cleanText,
        personalizationEvidence: stepEv.length > 0 ? stepEv : evidence.slice(0, 2),
      };
    });
  },

  synthesizeDeterministicSteps(
    lead: LeadDTO,
    evidence: PersonalizationEvidence[],
    _options: { campaignName?: string; customInstructions?: string }
  ): GeneratedEmailStep[] {
    const firstName = lead.name.split(' ')[0] || lead.name;
    const triggerExcerpt = lead.triggers?.[0] || `recent growth milestones at ${lead.company}`;
    const collateralExcerpt =
      evidence.find((e) => e.type === 'knowledge_chunk')?.excerpt ||
      'autonomous multi-channel pipeline qualification reducing rep discovery overhead by 68%';

    // Step 1: Initial Hook & Value Proposition
    const step1Subject = `Quick question regarding ${lead.company}'s outbound acceleration`;
    const step1Text = `Hi ${firstName},

I noticed ${triggerExcerpt} and wanted to reach out given your role leading ${lead.title} at ${lead.company}.

Teams in the ${lead.industry} space typically hit bottlenecks when scaling account discovery while maintaining high personalization standards. We built LeadForge to eliminate that manual drag by combining autonomous signal monitoring with explainable qualification.

Specifically, we help teams address: ${collateralExcerpt}.

Would you be open to a brief 10-minute introductory conversation next Tuesday to explore how this maps to your current pipeline goals?

Best regards,
LeadForge Autonomous Engagement Team`;

    const step1Html = `<p>Hi ${firstName},</p>
<p>I noticed ${triggerExcerpt} and wanted to reach out given your role leading ${lead.title} at ${lead.company}.</p>
<p>Teams in the ${lead.industry} space typically hit bottlenecks when scaling account discovery while maintaining high personalization standards. We built LeadForge to eliminate that manual drag by combining autonomous signal monitoring with explainable qualification.</p>
<p>Specifically, we help teams address: <em>${collateralExcerpt}</em>.</p>
<p>Would you be open to a brief 10-minute introductory conversation next Tuesday to explore how this maps to your current pipeline goals?</p>
<p>Best regards,<br/><strong>LeadForge Autonomous Engagement Team</strong></p>
<hr/><p style="font-size:12px;color:#888;">If you prefer not to receive further updates, reply with "unsubscribe" or opt out anytime.</p>`;

    // Step 2: Follow-up & Social Proof
    const step2Subject = `Re: Quick question regarding ${lead.company}'s outbound acceleration`;
    const step2Text = `Hi ${firstName},

Following up on my previous note regarding ${lead.company}'s revenue infrastructure.

Similar mid-market enterprise teams in ${lead.industry} often report that manual enrichment and disconnected lead lists waste up to 40% of their SDR capacity. By anchoring outbound sequences in verified buying signals, our users achieve 3.4x higher verified meeting conversion rates.

Would it make sense to share a 3-minute workflow video detailing how this works?

Best regards,
LeadForge Autonomous Engagement Team`;

    const step2Html = `<p>Hi ${firstName},</p>
<p>Following up on my previous note regarding ${lead.company}'s revenue infrastructure.</p>
<p>Similar mid-market enterprise teams in ${lead.industry} often report that manual enrichment and disconnected lead lists waste up to 40% of their SDR capacity. By anchoring outbound sequences in verified buying signals, our users achieve 3.4x higher verified meeting conversion rates.</p>
<p>Would it make sense to share a 3-minute workflow video detailing how this works?</p>
<p>Best regards,<br/><strong>LeadForge Autonomous Engagement Team</strong></p>
<hr/><p style="font-size:12px;color:#888;">If you prefer not to receive further updates, reply with "unsubscribe" or opt out anytime.</p>`;

    // Step 3: Breakaway / Final Permission Ask
    const step3Subject = `Closing the loop — ${lead.company} & LeadForge`;
    const step3Text = `Hi ${firstName},

I recognize your schedule as ${lead.title} is demanding and this may not be the optimal time for ${lead.company} to evaluate outbound automation.

I'll assume this isn't an active priority right now and close the loop from our side. If pipeline scalability becomes a focus next quarter, feel free to reconnect anytime.

Wishing you and the ${lead.company} team continued momentum.

Best regards,
LeadForge Autonomous Engagement Team`;

    const step3Html = `<p>Hi ${firstName},</p>
<p>I recognize your schedule as ${lead.title} is demanding and this may not be the optimal time for ${lead.company} to evaluate outbound automation.</p>
<p>I'll assume this isn't an active priority right now and close the loop from our side. If pipeline scalability becomes a focus next quarter, feel free to reconnect anytime.</p>
<p>Wishing you and the ${lead.company} team continued momentum.</p>
<p>Best regards,<br/><strong>LeadForge Autonomous Engagement Team</strong></p>
<hr/><p style="font-size:12px;color:#888;">If you prefer not to receive further updates, reply with "unsubscribe" or opt out anytime.</p>`;

    return [
      {
        stepNumber: 1,
        subject: step1Subject,
        bodyHtml: step1Html,
        bodyText: step1Text,
        personalizationEvidence: evidence.slice(0, 2),
      },
      {
        stepNumber: 2,
        subject: step2Subject,
        bodyHtml: step2Html,
        bodyText: step2Text,
        personalizationEvidence: evidence.slice(1, 3),
      },
      {
        stepNumber: 3,
        subject: step3Subject,
        bodyHtml: step3Html,
        bodyText: step3Text,
        personalizationEvidence: [evidence[0] || evidence[1]].filter(Boolean),
      },
    ];
  },
};

