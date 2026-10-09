import type {
  LeadEntity,
  LeadDTO,
  IcpProfileEntity,
  IcpProfileDTO,
  OpportunityEntity,
  OpportunityDTO,
  KnowledgeDocumentEntity,
  KnowledgeDocumentDTO,
  KnowledgeChunkEntity,
  KnowledgeChunkDTO,
  ActivityEntity,
  ActivityDTO,
  DiscoveryJobEntity,
  DiscoveryJobDTO,
  DiscoveredCandidateEntity,
  DiscoveredCandidateDTO,
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
    sourceProvider: entity.source_provider || 'manual',
    sourceUrl: entity.source_url || null,
    emailVerificationStatus: entity.email_verification_status || 'unverified',
    enrichmentProvenance: safeParseJson<any>(entity.enrichment_provenance, null),
    isMock: Boolean(entity.is_mock),
    isQualificationStale: Boolean(entity.is_qualification_stale),
    enrichedAt: entity.enriched_at || null,
    lastQualificationError: entity.last_qualification_error || null,
    conflictHistory: safeParseJson<any>(entity.conflict_history, []),
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
    filePath: entity.file_path || null,
    fileSize: entity.file_size || 0,
    mimeType: entity.mime_type || null,
    contentHash: entity.content_hash || null,
    processingStatus: entity.processing_status || (entity.status === 'Indexed' ? 'indexed' : 'uploaded'),
    errorMessage: entity.error_message || null,
    chunkCount: entity.chunk_count || 0,
    indexedAt: entity.indexed_at || null,
    embeddingModel: entity.embedding_model || null,
    createdAt: entity.created_at,
    updatedAt: entity.updated_at,
  };
}

export function knowledgeChunkEntityToDto(entity: KnowledgeChunkEntity): KnowledgeChunkDTO {
  return {
    id: entity.id,
    documentId: entity.document_id,
    chunkIndex: entity.chunk_index,
    content: entity.content,
    pageNumber: entity.page_number ?? null,
    sectionTitle: entity.section_title ?? null,
    charCount: entity.char_count,
    hasEmbedding: Boolean(entity.embedding),
    embeddingModel: entity.embedding_model ?? null,
    createdAt: entity.created_at,
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

export function discoveryJobEntityToDto(entity: DiscoveryJobEntity): DiscoveryJobDTO {
  return {
    id: entity.id,
    provider: entity.provider,
    mode: entity.mode,
    status: entity.status,
    queryParams: safeParseJson<Record<string, any>>(entity.query_params, {}),
    totalFound: entity.total_found ?? 0,
    candidatesFound: entity.candidates_found ?? entity.total_found ?? 0,
    candidatesProcessed: entity.candidates_processed ?? 0,
    candidatesIngested: entity.candidates_ingested ?? 0,
    candidatesSkipped: entity.candidates_skipped ?? 0,
    candidatesFailed: entity.candidates_failed ?? 0,
    errorMessage: entity.error_message || null,
    lastErrorCategory: entity.last_error_category || null,
    attemptCount: entity.attempt_count ?? 0,
    maxRetries: entity.max_retries ?? 3,
    retryCount: entity.retry_count ?? 0,
    nextRetryAt: entity.next_retry_at || null,
    cancelRequestedAt: entity.cancel_requested_at || null,
    claimedBy: entity.claimed_by || null,
    claimedAt: entity.claimed_at || null,
    leaseExpiresAt: entity.lease_expires_at || null,
    startedAt: entity.started_at || null,
    createdAt: entity.created_at,
    completedAt: entity.completed_at || null,
    updatedAt: entity.updated_at || entity.created_at,
  };
}

export function discoveredCandidateEntityToDto(entity: DiscoveredCandidateEntity): DiscoveredCandidateDTO {
  return {
    id: entity.id,
    jobId: entity.job_id,
    provider: entity.provider,
    mode: entity.mode,
    externalId: entity.external_id || null,
    companyName: entity.company_name,
    companyDomain: entity.company_domain,
    contactName: entity.contact_name,
    title: entity.title,
    email: entity.email || null,
    emailVerification: entity.email_verification,
    confidenceScore: entity.confidence_score ?? null,
    linkedin: entity.linkedin || null,
    location: entity.location || null,
    industry: entity.industry || null,
    companySize: entity.company_size || null,
    sourceUrls: safeParseJson<string[]>(entity.source_urls, []),
    provenanceMetadata: safeParseJson<Record<string, any>>(entity.provenance_metadata, {}),
    icpScorePreview: entity.icp_score_preview ?? null,
    icpTierPreview: entity.icp_tier_preview ?? null,
    dedupStatus: entity.dedup_status,
    existingLeadId: entity.existing_lead_id || null,
    status: entity.status,
    ingestedLeadId: entity.ingested_lead_id || null,
    processingError: entity.processing_error || null,
    isMock: Boolean(entity.is_mock),
    createdAt: entity.created_at,
  };
}


