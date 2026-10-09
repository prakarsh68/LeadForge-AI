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
  OutreachCampaignEntity,
  OutreachCampaignDTO,
  OutreachSequenceEntity,
  OutreachSequenceDTO,
  OutreachMessageEntity,
  OutreachMessageDTO,
  EngagementEventEntity,
  EngagementEventDTO,
  SuppressionEntity,
  SuppressionDTO,
  CrmSyncRecordEntity,
  CrmSyncRecordDTO,
  OpportunityScoreEntity,
  OpportunityScoreDTO,
  PersonalizationEvidence,
  OpportunityScoreFactor,
  SourceRegistryEntity,
  SourceRegistryDTO,
  SourceObservationEntity,
  SourceObservationDTO,
  SourceSignalEntity,
  SourceSignalDTO,
  SourcingPlanEntity,
  SourcingPlanDTO,
  SourcingJobEntity,
  SourcingJobDTO,
  SourceAttributionEntity,
  SourceAttributionDTO,
  SourceCapability,
  SourceCostModel,
  SourceRateLimits,
  SelectedSourcePlanEntry,
  FilteringStageBlueprint,
  SourcingPlanConstraints,
  StageExecutionMetric,
  AgenticSourcingStepEntity,
  AgenticSourcingStepDTO,
  AgenticSourcingRunEntity,
  AgenticSourcingRunDTO,
  SourcingOptimizationWeightEntity,
  SourcingOptimizationWeightDTO,
  SourcingExperimentEntity,
  SourcingExperimentDTO,
  ExperimentStrategyMetrics,
  ExperimentUpliftSummary,
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

export function outreachCampaignEntityToDto(
  entity: OutreachCampaignEntity,
  stats?: OutreachCampaignDTO['stats']
): OutreachCampaignDTO {
  return {
    id: entity.id,
    name: entity.name,
    description: entity.description || '',
    targetIcpId: entity.target_icp_id || null,
    status: entity.status,
    sendingLimits: safeParseJson<{ maxPerDay: number; minIntervalSeconds: number }>(
      entity.sending_limits,
      { maxPerDay: 50, minIntervalSeconds: 60 }
    ),
    scheduleWindow: safeParseJson<{ timezone: string; allowedDays: number[]; startHour: number; endHour: number }>(
      entity.schedule_window,
      { timezone: 'UTC', allowedDays: [1, 2, 3, 4, 5], startHour: 9, endHour: 17 }
    ),
    createdAt: entity.created_at,
    updatedAt: entity.updated_at,
    stats,
  };
}

export function outreachSequenceEntityToDto(
  entity: OutreachSequenceEntity,
  messages?: OutreachMessageDTO[],
  lead?: LeadDTO,
  campaign?: OutreachCampaignDTO
): OutreachSequenceDTO {
  return {
    id: entity.id,
    campaignId: entity.campaign_id || null,
    leadId: entity.lead_id,
    status: entity.status,
    currentStep: entity.current_step,
    maxSteps: entity.max_steps,
    nextScheduledAt: entity.next_scheduled_at || null,
    approvedAt: entity.approved_at || null,
    approvedBy: entity.approved_by || null,
    stopReason: entity.stop_reason || null,
    leaseExpiresAt: entity.lease_expires_at || null,
    claimedBy: entity.claimed_by || null,
    createdAt: entity.created_at,
    updatedAt: entity.updated_at,
    messages,
    lead,
    campaign,
  };
}

export function outreachMessageEntityToDto(entity: OutreachMessageEntity): OutreachMessageDTO {
  return {
    id: entity.id,
    sequenceId: entity.sequence_id,
    stepNumber: entity.step_number,
    subject: entity.subject,
    bodyHtml: entity.body_html,
    bodyText: entity.body_text,
    personalizationEvidence: safeParseJson<PersonalizationEvidence[]>(entity.personalization_evidence, []),
    status: entity.status,
    providerMessageId: entity.provider_message_id || null,
    attemptCount: entity.attempt_count,
    scheduledAt: entity.scheduled_at || null,
    sentAt: entity.sent_at || null,
    errorMessage: entity.error_message || null,
    createdAt: entity.created_at,
    updatedAt: entity.updated_at,
  };
}

export function engagementEventEntityToDto(entity: EngagementEventEntity): EngagementEventDTO {
  return {
    id: entity.id,
    leadId: entity.lead_id,
    sequenceId: entity.sequence_id || null,
    messageId: entity.message_id || null,
    campaignId: entity.campaign_id || null,
    eventType: entity.event_type,
    eventTimestamp: entity.event_timestamp,
    providerEventId: entity.provider_event_id || null,
    sourceMetadata: safeParseJson<Record<string, any>>(entity.source_metadata, {}),
    createdAt: entity.created_at,
  };
}

export function suppressionEntityToDto(entity: SuppressionEntity): SuppressionDTO {
  return {
    id: entity.id,
    email: entity.email,
    reason: entity.reason,
    source: entity.source,
    createdAt: entity.created_at,
  };
}

export function crmSyncRecordEntityToDto(entity: CrmSyncRecordEntity): CrmSyncRecordDTO {
  return {
    id: entity.id,
    leadId: entity.lead_id,
    opportunityId: entity.opportunity_id || null,
    crmProvider: entity.crm_provider,
    externalContactId: entity.external_contact_id || null,
    externalCompanyId: entity.external_company_id || null,
    externalDealId: entity.external_deal_id || null,
    syncStatus: entity.sync_status,
    lastSyncedAt: entity.last_synced_at || null,
    retryCount: entity.retry_count,
    errorMessage: entity.error_message || null,
    fieldMappings: safeParseJson<Record<string, any>>(entity.field_mappings, {}),
    createdAt: entity.created_at,
    updatedAt: entity.updated_at,
  };
}

export function opportunityScoreEntityToDto(entity: OpportunityScoreEntity): OpportunityScoreDTO {
  return {
    id: entity.id,
    leadId: entity.lead_id,
    opportunityId: entity.opportunity_id || null,
    score: entity.score,
    readinessTier: entity.readiness_tier,
    factors: safeParseJson<OpportunityScoreFactor[]>(entity.factors, []),
    evidenceReferences: safeParseJson<PersonalizationEvidence[]>(entity.evidence_references, []),
    scoringVersion: entity.scoring_version,
    isStale: Boolean(entity.is_stale),
    evaluatedAt: entity.evaluated_at,
    createdAt: entity.created_at,
  };
}

// Phase 6A: Source Intelligence Serializers

export function sourceRegistryEntityToDto(entity: SourceRegistryEntity): SourceRegistryDTO {
  return {
    id: entity.id,
    name: entity.name,
    providerType: entity.provider_type,
    capabilities: safeParseJson<SourceCapability[]>(entity.capabilities, []),
    isEnabled: Boolean(entity.is_enabled),
    isConfigured: Boolean(entity.is_configured),
    healthStatus: entity.health_status,
    lastHealthCheck: entity.last_health_check || null,
    costModel: safeParseJson<SourceCostModel>(entity.cost_model, { currency: 'USD' }),
    rateLimits: safeParseJson<SourceRateLimits>(entity.rate_limits, { requestsPerMinute: 60, dailyQuota: 1000 }),
    metadata: safeParseJson<Record<string, any>>(entity.metadata, {}),
    createdAt: entity.created_at,
    updatedAt: entity.updated_at,
  };
}

export function sourceObservationEntityToDto(entity: SourceObservationEntity): SourceObservationDTO {
  return {
    id: entity.id,
    sourceId: entity.source_id,
    sourceRecordId: entity.source_record_id || null,
    entityType: entity.entity_type,
    entityKey: entity.entity_key,
    observedAt: entity.observed_at,
    retrievedAt: entity.retrieved_at,
    sourceUrl: entity.source_url || null,
    rawPayload: safeParseJson<Record<string, any>>(entity.raw_payload, {}),
    fieldProvenance: safeParseJson<Record<string, any>>(entity.field_provenance, {}),
    fingerprint: entity.fingerprint,
    processingStatus: entity.processing_status,
    companyDomain: entity.company_domain || null,
    contactEmail: entity.contact_email || null,
    createdAt: entity.created_at,
  };
}

export function sourceSignalEntityToDto(entity: SourceSignalEntity): SourceSignalDTO {
  return {
    id: entity.id,
    companyName: entity.company_name,
    companyDomain: entity.company_domain,
    signalCategory: entity.signal_category,
    sourceId: entity.source_id,
    sourceUrl: entity.source_url || null,
    eventTimestamp: entity.event_timestamp,
    observedAt: entity.observed_at,
    signalText: entity.signal_text,
    structuredEvidence: safeParseJson<Record<string, any>>(entity.structured_evidence, {}),
    confidence: entity.confidence,
    relevanceScore: entity.relevance_score,
    dedupFingerprint: entity.dedup_fingerprint,
    createdAt: entity.created_at,
  };
}

export function sourcingPlanEntityToDto(entity: SourcingPlanEntity): SourcingPlanDTO {
  return {
    id: entity.id,
    name: entity.name,
    targetIcpId: entity.target_icp_id || null,
    campaignObjective: entity.campaign_objective,
    constraints: safeParseJson<SourcingPlanConstraints>(entity.constraints, {}),
    selectedSources: safeParseJson<SelectedSourcePlanEntry[]>(entity.selected_sources, []),
    stagesPipeline: safeParseJson<FilteringStageBlueprint[]>(entity.stages_pipeline, []),
    estimatedCost: entity.estimated_cost != null ? entity.estimated_cost : null,
    costKnown: Boolean(entity.cost_known),
    expectedYield: entity.expected_yield,
    status: entity.status,
    createdAt: entity.created_at,
    updatedAt: entity.updated_at,
  };
}

export function sourcingJobEntityToDto(entity: SourcingJobEntity): SourcingJobDTO {
  return {
    id: entity.id,
    planId: entity.plan_id,
    status: entity.status,
    stageCounts: safeParseJson<Record<string, StageExecutionMetric>>(entity.stage_counts, {}),
    recordsSourced: entity.records_sourced,
    recordsDeduped: entity.records_deduped,
    recordsScreened: entity.records_screened,
    recordsQualified: entity.records_qualified,
    recordsStaged: entity.records_staged,
    costIncurred: entity.cost_incurred,
    errorMessage: entity.error_message || null,
    claimedBy: entity.claimed_by || null,
    leaseExpiresAt: entity.lease_expires_at || null,
    startedAt: entity.started_at || null,
    completedAt: entity.completed_at || null,
    createdAt: entity.created_at,
    updatedAt: entity.updated_at,
  };
}

export function sourceAttributionEntityToDto(entity: SourceAttributionEntity): SourceAttributionDTO {
  return {
    id: entity.id,
    leadId: entity.lead_id || null,
    candidateId: entity.candidate_id || null,
    sourceId: entity.source_id,
    role: entity.role,
    confidence: entity.confidence,
    attributedAt: entity.attributed_at,
  };
}

export function agenticSourcingStepEntityToDto(entity: AgenticSourcingStepEntity): AgenticSourcingStepDTO {
  return {
    id: entity.id,
    runId: entity.run_id,
    stepNumber: entity.step_number,
    toolName: entity.tool_name,
    toolInput: safeParseJson<Record<string, any>>(entity.tool_input, {}),
    toolOutput: safeParseJson<Record<string, any>>(entity.tool_output, {}),
    rationale: entity.rationale || '',
    status: entity.status,
    costIncurred: entity.cost_incurred,
    durationMs: entity.duration_ms,
    createdAt: entity.created_at,
  };
}

export function agenticSourcingRunEntityToDto(
  entity: AgenticSourcingRunEntity,
  steps: AgenticSourcingStepDTO[] = []
): AgenticSourcingRunDTO {
  return {
    id: entity.id,
    name: entity.name,
    naturalLanguageIntent: entity.natural_language_intent,
    targetIcpId: entity.target_icp_id || null,
    planId: entity.plan_id || null,
    status: entity.status,
    budgetLimit: entity.budget_limit,
    budgetSpent: entity.budget_spent,
    targetYield: entity.target_yield,
    yieldAchieved: entity.yield_achieved,
    efficiencyScore: entity.efficiency_score,
    executionStrategy: safeParseJson<Record<string, any>>(entity.execution_strategy, {}),
    errorMessage: entity.error_message || null,
    steps,
    startedAt: entity.started_at || null,
    completedAt: entity.completed_at || null,
    createdAt: entity.created_at,
    updatedAt: entity.updated_at,
  };
}

export function sourcingOptimizationWeightEntityToDto(
  entity: SourcingOptimizationWeightEntity,
  sourceName?: string
): SourcingOptimizationWeightDTO {
  return {
    id: entity.id,
    sourceId: entity.source_id,
    sourceName,
    empiricalYieldRate: entity.empirical_yield_rate,
    empiricalDuplicateRate: entity.empirical_duplicate_rate,
    empiricalReplyRate: entity.empirical_reply_rate,
    empiricalMeetingRate: entity.empirical_meeting_rate,
    qualityMultiplier: entity.quality_multiplier,
    learnedCostEfficiency: entity.learned_cost_efficiency,
    totalLeadsAttributed: entity.total_leads_attributed,
    totalMeetingsAttributed: entity.total_meetings_attributed,
    totalPipelineAttributed: entity.total_pipeline_attributed,
    lastOptimizedAt: entity.last_optimized_at,
    updatedAt: entity.updated_at,
  };
}

export function sourcingExperimentEntityToDto(entity: SourcingExperimentEntity): SourcingExperimentDTO {
  return {
    id: entity.id,
    name: entity.name,
    description: entity.description || '',
    status: entity.status,
    baselineStrategy: entity.baseline_strategy,
    agenticStrategy: entity.agentic_strategy,
    sampleSize: entity.sample_size,
    baselineMetrics: safeParseJson<ExperimentStrategyMetrics>(entity.baseline_metrics, {
      yieldCount: 0,
      yieldRatePct: 0,
      totalCost: 0,
      unitCost: 0,
      efficiencyPct: 0,
      durationMs: 0,
      meetingRatePct: 0,
    }),
    agenticMetrics: safeParseJson<ExperimentStrategyMetrics>(entity.agentic_metrics, {
      yieldCount: 0,
      yieldRatePct: 0,
      totalCost: 0,
      unitCost: 0,
      efficiencyPct: 0,
      durationMs: 0,
      meetingRatePct: 0,
    }),
    upliftSummary: safeParseJson<ExperimentUpliftSummary>(entity.uplift_summary, {
      yieldUpliftPct: 0,
      costReductionPct: 0,
      efficiencyGainPct: 0,
      netRoiImprovement: '0%',
    }),
    concludedAt: entity.concluded_at,
    createdAt: entity.created_at,
  };
}




