import { getDb } from '../db/database.js';
import type {
  OpportunityScoreDTO,
  OpportunityScoreFactor,
  OpportunityTier,
  PersonalizationEvidence,
} from '../types/index.js';
import { opportunityScoreEntityToDto } from '../utils/serializers.js';

export const opportunityScoringService = {
  evaluateOpportunityScore(leadId: string): OpportunityScoreDTO {
    const db = getDb();
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId) as any;
    if (!lead) {
      throw new Error(`Lead not found for opportunity scoring: ${leadId}`);
    }

    const opportunity = db.prepare('SELECT * FROM opportunities WHERE lead_id = ?').get(leadId) as any;
    const events = db.prepare('SELECT * FROM engagement_events WHERE lead_id = ?').all(leadId) as any[];

    const factors: OpportunityScoreFactor[] = [];
    const evidenceReferences: PersonalizationEvidence[] = [];

    // 1. Pillar: ICP Fit Score (Weight: 25%)
    const icpScore = lead.score ?? 50;
    const icpContribution = Math.round((icpScore / 100) * 25);
    factors.push({
      pillar: 'icp_fit',
      name: 'ICP Profile Alignment',
      weight: 25,
      rawPoints: icpScore,
      maxPoints: 100,
      contribution: icpContribution,
      summary: `Lead scored ${icpScore}/100 in deterministic ICP qualification (${lead.tier || 'medium'} tier).`,
    });
    evidenceReferences.push({
      type: 'icp_criteria',
      title: 'Deterministic ICP Alignment',
      excerpt: `Qualified score ${icpScore}/100 with ${lead.tier || 'medium'} tier matching criteria`,
      confidence: 1.0,
    });

    // 2. Pillar: Data Completeness & Verification (Weight: 15%)
    let verifPoints = 0;
    if (lead.email_verification_status === 'verified') {
      verifPoints += 8;
    } else if (lead.email_verification_status === 'unverified') {
      verifPoints += 4;
    }
    if (lead.linkedin && lead.linkedin.length > 5) {
      verifPoints += 4;
    }
    if (lead.company_domain && lead.company_size) {
      verifPoints += 3;
    }
    const verifContribution = Math.min(15, verifPoints);
    factors.push({
      pillar: 'verification',
      name: 'Data Completeness & Contact Verification',
      weight: 15,
      rawPoints: verifPoints,
      maxPoints: 15,
      contribution: verifContribution,
      summary: `Email verification (${lead.email_verification_status || 'unverified'}) and confirmed LinkedIn profile.`,
    });
    evidenceReferences.push({
      type: 'company_data',
      title: 'Contact Verification Provenance',
      excerpt: `Email: ${lead.email} (${lead.email_verification_status || 'unverified'}), LinkedIn verified`,
      confidence: 0.9,
    });

    // 3. Pillar: Engagement Velocity & Signals (Weight: 40%)
    let engagementPoints = 0;
    const hasOpened = events.some((e) => e.event_type === 'opened');
    const hasClicked = events.some((e) => e.event_type === 'clicked');
    const hasReplied = events.some((e) => e.event_type === 'replied');
    const hasMeeting = events.some((e) => e.event_type === 'meeting_booked');
    const hasBounced = events.some((e) => e.event_type === 'bounced');

    if (hasOpened) engagementPoints += 8;
    if (hasClicked) engagementPoints += 12;
    if (hasReplied) engagementPoints += 20;
    if (hasMeeting) engagementPoints += 30;

    let engagementSummary = 'No outbound engagement recorded yet.';
    if (hasMeeting) {
      engagementSummary = 'Meeting or product demonstration scheduled (+30 pts).';
    } else if (hasReplied) {
      engagementSummary = 'Direct response received from prospect (+20 pts).';
    } else if (hasClicked || hasOpened) {
      engagementSummary = 'Prospect opened/clicked sequence links (+10-15 pts).';
    }

    if (hasBounced) {
      engagementPoints -= 40;
      engagementSummary = 'Delivery bounced (-40 pts penalty).';
    }

    const engagementContribution = Math.max(0, Math.min(40, engagementPoints));
    factors.push({
      pillar: 'engagement',
      name: 'Engagement Velocity & Prospect Signals',
      weight: 40,
      rawPoints: engagementPoints,
      maxPoints: 40,
      contribution: engagementContribution,
      summary: engagementSummary,
    });
    if (events.length > 0) {
      evidenceReferences.push({
        type: 'lead_trigger',
        title: 'Engagement Activity Signals',
        excerpt: `${events.length} tracked outbound interactions; latest event: ${events[events.length - 1]?.event_type}`,
        confidence: 0.95,
      });
    }

    // 4. Pillar: Deal Size & Buying Intent (Weight: 20%)
    let dealPoints = 0;
    const dealValue = lead.deal_value || 0;
    if (dealValue >= 75000) dealPoints += 10;
    else if (dealValue >= 35000) dealPoints += 7;
    else if (dealValue > 0) dealPoints += 4;

    let parsedTriggers: string[] = [];
    try {
      parsedTriggers = JSON.parse(lead.triggers || '[]');
    } catch {
      parsedTriggers = [];
    }

    if (parsedTriggers.length >= 3) dealPoints += 10;
    else if (parsedTriggers.length >= 1) dealPoints += 6;

    const dealContribution = Math.min(20, dealPoints);
    factors.push({
      pillar: 'deal_intent',
      name: 'Deal Size & Intent Triggers',
      weight: 20,
      rawPoints: dealPoints,
      maxPoints: 20,
      contribution: dealContribution,
      summary: `Estimated deal value $${dealValue.toLocaleString()} with ${parsedTriggers.length} verified buying triggers.`,
    });
    if (parsedTriggers.length > 0) {
      evidenceReferences.push({
        type: 'lead_trigger',
        title: 'Observed Intent Milestones',
        excerpt: parsedTriggers.slice(0, 2).join('; '),
        confidence: 0.9,
      });
    }

    // Total Score Calculation
    let totalScore = icpContribution + verifContribution + engagementContribution + dealContribution;
    totalScore = Math.max(0, Math.min(100, totalScore));

    let readinessTier: OpportunityTier = 'low';
    if (totalScore >= 75) readinessTier = 'high';
    else if (totalScore >= 50) readinessTier = 'medium';

    const scoreId = `oppscore-${leadId}`;
    const now = new Date().toISOString();

    // Persist to opportunity_scores
    db.prepare(`
      INSERT INTO opportunity_scores (
        id, lead_id, opportunity_id, score, readiness_tier, factors,
        evidence_references, scoring_version, is_stale, evaluated_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, '1.0', 0, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        score = excluded.score,
        readiness_tier = excluded.readiness_tier,
        factors = excluded.factors,
        evidence_references = excluded.evidence_references,
        is_stale = 0,
        evaluated_at = excluded.evaluated_at
    `).run(
      scoreId,
      leadId,
      opportunity?.id || null,
      totalScore,
      readinessTier,
      JSON.stringify(factors),
      JSON.stringify(evidenceReferences),
      now,
      now
    );

    // Update opportunities confidence_score
    if (opportunity) {
      db.prepare('UPDATE opportunities SET confidence_score = ?, updated_at = ? WHERE id = ?').run(
        totalScore,
        now,
        opportunity.id
      );
    }

    const saved = db.prepare('SELECT * FROM opportunity_scores WHERE id = ?').get(scoreId) as any;
    return opportunityScoreEntityToDto(saved);
  },

  getScoreForLead(leadId: string): OpportunityScoreDTO | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM opportunity_scores WHERE lead_id = ?').get(leadId) as any;
    if (!row) {
      // Evaluate on demand
      try {
        return this.evaluateOpportunityScore(leadId);
      } catch {
        return null;
      }
    }
    return opportunityScoreEntityToDto(row);
  },
};

