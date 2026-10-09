import type {
  LeadEntity,
  LeadDTO,
  IcpProfileEntity,
  IcpProfileDTO,
  OpportunityEntity,
  OpportunityDTO,
  KnowledgeDocumentEntity,
  KnowledgeDocumentDTO,
  ActivityEntity,
  ActivityDTO,
} from '../types/index.js';

function safeParseJson<T>(raw: string | undefined | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function leadEntityToDto(entity: LeadEntity): LeadDTO {
  return {
    id: entity.id,
    name: entity.name,
    title: entity.title,
    company: entity.company,
    companyDomain: entity.company_domain,
    avatar: entity.avatar || '',
    email: entity.email,
    linkedin: entity.linkedin || '',
    location: entity.location || '',
    industry: entity.industry,
    companySize: entity.company_size,
    score: entity.score,
    tier: entity.tier,
    status: entity.status,
    dealValue: entity.deal_value,
    triggers: safeParseJson<string[]>(entity.triggers, []),
    notes: entity.notes || '',
    lastActive: entity.last_active || '',
    qualificationBreakdown: safeParseJson<any>(entity.qualification_breakdown, null),
    qualifiedAt: entity.qualified_at || null,
    createdAt: entity.created_at,
    updatedAt: entity.updated_at,
  };
}

export function icpEntityToDto(entity: IcpProfileEntity): IcpProfileDTO {
  return {
    id: entity.id,
    name: entity.name,
    description: entity.description,
    targetIndustries: safeParseJson<string[]>(entity.target_industries, []),
    companySizeRanges: safeParseJson<string[]>(entity.company_size_ranges, []),
    targetLocations: safeParseJson<string[]>(entity.target_locations, []),
    revenueRanges: safeParseJson<string[]>(entity.revenue_ranges, []),
    targetRoles: safeParseJson<string[]>(entity.target_roles, []),
    seniorityLevels: safeParseJson<string[]>(entity.seniority_levels, []),
    buyingTriggers: safeParseJson<string[]>(entity.buying_triggers, []),
    techStack: safeParseJson<string[]>(entity.tech_stack, []),
    minScoreThreshold: entity.min_score_threshold,
    negativeKeywords: safeParseJson<string[]>(entity.negative_keywords, []),
    scoringWeights: safeParseJson<any>(entity.scoring_weights, {
      industry: 30,
      roleSeniority: 25,
      intentTriggers: 30,
      techStack: 15,
    }),
    isActive: Boolean(entity.is_active),
    createdAt: entity.created_at,
    updatedAt: entity.updated_at,
  };
}

export function opportunityEntityToDto(
  opp: OpportunityEntity,
  lead?: Partial<LeadEntity> | null
): OpportunityDTO {
  const dto: OpportunityDTO = {
    id: opp.id,
    leadId: opp.lead_id,
    title: opp.title,
    stage: opp.stage,
    dealValue: opp.deal_value,
    confidenceScore: opp.confidence_score,
    expectedCloseDate: opp.expected_close_date || null,
    createdAt: opp.created_at,
    updatedAt: opp.updated_at,
  };

  if (lead && lead.name) {
    dto.lead = {
      name: lead.name,
      company: lead.company || '',
      avatar: lead.avatar || '',
      email: lead.email || '',
      score: lead.score ?? opp.confidence_score,
      tier: (lead.tier as any) || (opp.confidence_score >= 85 ? 'high' : opp.confidence_score >= 70 ? 'medium' : 'low'),
      industry: lead.industry || '',
    };
  }

  return dto;
}

export function knowledgeDocEntityToDto(entity: KnowledgeDocumentEntity): KnowledgeDocumentDTO {
  return {
    id: entity.id,
    title: entity.title,
    category: entity.category,
    type: entity.type,
    sizeOrTokens: entity.size_or_tokens,
    status: entity.status,
    uploadedAt: entity.uploaded_at,
    summary: entity.summary || '',
    createdAt: entity.created_at,
    updatedAt: entity.updated_at,
  };
}

export function activityEntityToDto(entity: ActivityEntity): ActivityDTO {
  return {
    id: entity.id,
    type: entity.type,
    title: entity.title,
    description: entity.description,
    timestamp: entity.timestamp,
    badge: entity.badge || undefined,
    createdAt: entity.created_at,
  };
}

