export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Proposal' | 'Won' | 'Disqualified';

export type LeadScoreTier = 'high' | 'medium' | 'low';

export interface LeadEntity {
  id: string;
  name: string;
  title: string;
  company: string;
  company_domain: string;
  avatar?: string;
  email: string;
  linkedin?: string;
  location?: string;
  industry: string;
  company_size: string;
  score: number;
  tier: LeadScoreTier;
  status: LeadStatus;
  deal_value: number;
  triggers: string; // JSON string
  notes?: string;
  last_active?: string;
  qualification_breakdown?: string | null;
  qualified_at?: string | null;
  source_provider?: string;
  source_url?: string | null;
  email_verification_status?: VerificationStatus;
  enrichment_provenance?: string | null;
  is_mock?: number;
  is_qualification_stale?: number;
  enriched_at?: string | null;
  last_qualification_error?: string | null;
  conflict_history?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FieldConflict {
  fieldName: string;
  existingValue: any;
  existingSource: string;
  existingStatus?: VerificationStatus;
  conflictingValue: any;
  conflictingSource: string;
  conflictingStatus?: VerificationStatus;
  recordedAt: string;
  resolution: 'preserved_existing' | 'overwritten_by_higher_precedence';
}

export type VerificationStatus = 'verified' | 'unverified' | 'inferred' | 'risky' | 'undeliverable';
export type DedupStatus = 'new' | 'existing_lead' | 'same_company_existing' | 'duplicate_in_job';
export type CandidateStatus = 'staged' | 'ingested' | 'rejected';
export type DiscoveryJobStatus = 'queued' | 'pending' | 'running' | 'completed' | 'partially_completed' | 'failed' | 'cancelled';
export type DiscoveryMode = 'real' | 'demo';

export interface FieldProvenance<T = any> {
  fieldName: string;
  value: T;
  sourceProvider: string;
  sourceUrl?: string | null;
  retrievedAt: string;
  verificationStatus: VerificationStatus;
  confidence?: number | null;
}

export interface DiscoveryJobEntity {
  id: string;
  provider: string;
  mode: DiscoveryMode;
  status: DiscoveryJobStatus;
  query_params: string;
  total_found: number;
  candidates_found: number;
  candidates_processed: number;
  candidates_ingested: number;
  candidates_skipped: number;
  candidates_failed: number;
  error_message?: string | null;
  last_error_category?: string | null;
  attempt_count: number;
  max_retries: number;
  retry_count: number;
  next_retry_at?: string | null;
  cancel_requested_at?: string | null;
  claimed_by?: string | null;
  claimed_at?: string | null;
  lease_expires_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiscoveryJobDTO {
  id: string;
  provider: string;
  mode: DiscoveryMode;
  status: DiscoveryJobStatus;
  queryParams: Record<string, any>;
  totalFound: number;
  candidatesFound: number;
  candidatesProcessed: number;
  candidatesIngested: number;
  candidatesSkipped: number;
  candidatesFailed: number;
  errorMessage?: string | null;
  lastErrorCategory?: string | null;
  attemptCount: number;
  maxRetries: number;
  retryCount: number;
  nextRetryAt?: string | null;
  cancelRequestedAt?: string | null;
  claimedBy?: string | null;
  claimedAt?: string | null;
  leaseExpiresAt?: string | null;
  startedAt?: string | null;
  createdAt: string;
  completedAt?: string | null;
  updatedAt: string;
}

export interface DiscoveredCandidateEntity {
  id: string;
  job_id: string;
  provider: string;
  mode: DiscoveryMode;
  external_id?: string | null;
  company_name: string;
  company_domain: string;
  contact_name: string;
  title: string;
  email?: string | null;
  email_verification: VerificationStatus;
  confidence_score?: number | null;
  linkedin?: string | null;
  location?: string | null;
  industry?: string | null;
  company_size?: string | null;
  source_urls: string;
  provenance_metadata: string;
  icp_score_preview?: number | null;
  icp_tier_preview?: LeadScoreTier | null;
  dedup_status: DedupStatus;
  existing_lead_id?: string | null;
  status: CandidateStatus;
  ingested_lead_id?: string | null;
  processing_error?: string | null;
  is_mock: number;
  created_at: string;
}

export interface DiscoveredCandidateDTO {
  id: string;
  jobId: string;
  provider: string;
  mode: DiscoveryMode;
  externalId?: string | null;
  companyName: string;
  companyDomain: string;
  contactName: string;
  title: string;
  email?: string | null;
  emailVerification: VerificationStatus;
  confidenceScore?: number | null;
  linkedin?: string | null;
  location?: string | null;
  industry?: string | null;
  companySize?: string | null;
  sourceUrls: string[];
  provenanceMetadata: Record<string, FieldProvenance>;
  icpScorePreview?: number | null;
  icpTierPreview?: LeadScoreTier | null;
  dedupStatus: DedupStatus;
  existingLeadId?: string | null;
  status: CandidateStatus;
  ingestedLeadId?: string | null;
  processingError?: string | null;
  isMock: boolean;
  createdAt: string;
}

export interface DiscoveryProviderStatusDTO {
  id: string;
  displayName: string;
  mode: DiscoveryMode;
  isConfigured: boolean;
  description: string;
  capabilities: string[];
}

export interface IcpProfileEntity {
  id: string;
  name: string;
  description: string;
  target_industries: string; // JSON string
  company_size_ranges: string; // JSON string
  target_locations: string; // JSON string
  revenue_ranges: string; // JSON string
  target_roles: string; // JSON string
  seniority_levels: string; // JSON string
  buying_triggers: string; // JSON string
  tech_stack: string; // JSON string
  min_score_threshold: number;
  negative_keywords: string; // JSON string
  scoring_weights?: string; // JSON string
  is_active: number; // 0 or 1
  created_at: string;
  updated_at: string;
}

export interface LeadQualificationEntity {
  id: string;
  lead_id: string;
  icp_profile_id: string;
  score: number;
  tier: LeadScoreTier;
  is_qualified: number;
  breakdown: string; // JSON string of CriterionEvaluation[]
  reasons: string;   // JSON string of string[]
  evaluated_at: string;
  created_at: string;
}

export interface IcpScoringWeights {
  industry: number;
  roleSeniority: number;
  intentTriggers: number;
  techStack: number;
}

export type EvaluationStatus = 'match' | 'partial' | 'mismatch' | 'no_data';

export interface CriterionEvaluation {
  id: 'industry' | 'company_size' | 'role_seniority' | 'buying_triggers' | 'tech_stack' | 'negative_keywords';
  name: string;
  weight: number;
  pointsEarned: number;
  status: EvaluationStatus;
  evidence: string;
  targetCriteria: string;
  reason: string;
}

export interface QualificationResult {
  leadId: string;
  leadName: string;
  company: string;
  icpProfileId: string;
  icpProfileName: string;
  overallScore: number;
  tier: LeadScoreTier;
  isQualified: boolean;
  threshold: number;
  criteria: CriterionEvaluation[];
  summaryReasons: string[];
  disclaimers: string;
  evaluatedAt: string;
}

export type KnowledgeProcessingStatus =
  | 'uploaded'
  | 'extracting'
  | 'extracted'
  | 'chunking'
  | 'chunked'
  | 'indexing'
  | 'indexed'
  | 'failed';

export interface KnowledgeDocumentEntity {
  id: string;
  title: string;
  category: 'Product Specs' | 'Battlecards' | 'Case Studies' | 'Pricing' | 'Compliance';
  type: 'pdf' | 'doc' | 'docx' | 'txt' | 'md' | 'url' | 'notion';
  size_or_tokens: string;
  status: 'Indexed' | 'Syncing' | 'Ready';
  uploaded_at: string;
  summary: string;
  file_path?: string | null;
  file_size?: number;
  mime_type?: string | null;
  content_hash?: string | null;
  processing_status?: KnowledgeProcessingStatus;
  error_message?: string | null;
  chunk_count?: number;
  indexed_at?: string | null;
  embedding_model?: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeChunkEntity {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  page_number?: number | null;
  section_title?: string | null;
  char_count: number;
  embedding?: string | null;
  embedding_model?: string | null;
  created_at: string;
}

export interface ActivityEntity {
  id: string;
  type: 'discovery' | 'score' | 'outreach' | 'stage_change';
  title: string;
  description: string;
  timestamp: string;
  badge?: string;
  created_at: string;
}

export interface OpportunityEntity {
  id: string;
  lead_id: string;
  title: string;
  stage: LeadStatus;
  deal_value: number;
  confidence_score: number;
  expected_close_date?: string | null;
  created_at: string;
  updated_at: string;
}

// Client-facing DTOs matching frontend models
export interface LeadDTO {
  id: string;
  name: string;
  title: string;
  company: string;
  companyDomain: string;
  avatar: string;
  email: string;
  linkedin: string;
  location: string;
  industry: string;
  companySize: string;
  score: number;
  tier: LeadScoreTier;
  status: LeadStatus;
  dealValue: number;
  triggers: string[];
  notes: string;
  lastActive: string;
  qualificationBreakdown?: QualificationResult | null;
  qualifiedAt?: string | null;
  sourceProvider?: string;
  sourceUrl?: string | null;
  emailVerificationStatus?: VerificationStatus;
  enrichmentProvenance?: Record<string, FieldProvenance> | null;
  isMock?: boolean;
  isQualificationStale?: boolean;
  enrichedAt?: string | null;
  lastQualificationError?: string | null;
  conflictHistory?: FieldConflict[];
  createdAt: string;
  updatedAt: string;
}

export interface IcpProfileDTO {
  id: string;
  name: string;
  description: string;
  targetIndustries: string[];
  companySizeRanges: string[];
  targetLocations: string[];
  revenueRanges: string[];
  targetRoles: string[];
  seniorityLevels: string[];
  buyingTriggers: string[];
  techStack: string[];
  minScoreThreshold: number;
  negativeKeywords: string[];
  scoringWeights?: IcpScoringWeights;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeChunkDTO {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  pageNumber?: number | null;
  sectionTitle?: string | null;
  charCount: number;
  hasEmbedding: boolean;
  embeddingModel?: string | null;
  createdAt: string;
}

export interface KnowledgeDocumentDTO {
  id: string;
  title: string;
  category: 'Product Specs' | 'Battlecards' | 'Case Studies' | 'Pricing' | 'Compliance';
  type: 'pdf' | 'doc' | 'docx' | 'txt' | 'md' | 'url' | 'notion';
  sizeOrTokens: string;
  status: 'Indexed' | 'Syncing' | 'Ready';
  uploadedAt: string;
  summary: string;
  filePath?: string | null;
  fileSize?: number;
  mimeType?: string | null;
  contentHash?: string | null;
  processingStatus?: KnowledgeProcessingStatus;
  errorMessage?: string | null;
  chunkCount?: number;
  indexedAt?: string | null;
  embeddingModel?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeCitation {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  category: string;
  pageNumber?: number | null;
  sectionTitle?: string | null;
  excerpt: string;
  similarityScore?: number;
}

export interface KnowledgeSearchResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  category: string;
  content: string;
  pageNumber?: number | null;
  sectionTitle?: string | null;
  similarityScore: number;
  searchMode: 'semantic' | 'keyword';
}

export interface KnowledgeAskResult {
  answer: string;
  citations: KnowledgeCitation[];
  confidence: number;
  searchMode: 'semantic' | 'keyword';
  model?: string;
  isAiConfigured: boolean;
  retrievedCount: number;
}

export interface KnowledgeConfigDTO {
  aiConfigured: boolean;
  embeddingModel: string;
  chatModel: string;
  baseUrl: string;
  totalDocuments: number;
  totalChunks: number;
  totalEmbeddedChunks: number;
}

export interface ActivityDTO {
  id: string;
  type: 'discovery' | 'score' | 'outreach' | 'stage_change';
  title: string;
  description: string;
  timestamp: string;
  badge?: string;
  createdAt: string;
}

export interface OpportunityDTO {
  id: string;
  leadId: string;
  title: string;
  stage: LeadStatus;
  dealValue: number;
  confidenceScore: number;
  expectedCloseDate: string | null;
  createdAt: string;
  updatedAt: string;
  lead?: {
    name: string;
    company: string;
    avatar: string;
    email: string;
    score: number;
    tier: LeadScoreTier;
    industry: string;
  };
}

export interface PipelineSummaryDTO {
  totalPipelineValue: number;
  totalOpportunities: number;
  stageCounts: Record<LeadStatus, number>;
  stageValues: Record<LeadStatus, number>;
  winRate: number;
  averageDealValue: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  meta?: Record<string, any>;
  message?: string;
  error?: string;
  details?: any;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptimeSeconds: number;
  timestamp: string;
  environment: string;
  database: {
    status: 'connected' | 'error';
    type: string;
    path: string;
    tables: {
      leads: number;
      icp_profiles: number;
      knowledge_documents: number;
      activities: number;
      opportunities?: number;
    } | null;
    error?: string;
  };
}

// Phase 5 Types: Outreach, Sequences, Messages, Events, Suppression, CRM & Opportunity Scoring

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';
export type SequenceStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'scheduled'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'stopped_on_reply'
  | 'stopped_on_opt_out'
  | 'failed';

export type OutreachMessageStatus =
  | 'draft'
  | 'approved'
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'failed'
  | 'cancelled';

export type EngagementEventType =
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'replied'
  | 'bounced'
  | 'complained'
  | 'unsubscribed'
  | 'meeting_booked';

export type SuppressionReason = 'unsubscribed' | 'bounced' | 'manual' | 'complaint';
export type CrmProvider = 'hubspot' | 'salesforce';
export type CrmSyncStatus = 'synced' | 'pending' | 'failed';
export type OpportunityTier = 'high' | 'medium' | 'low';

export interface PersonalizationEvidence {
  type: 'lead_trigger' | 'icp_criteria' | 'knowledge_chunk' | 'company_data';
  title: string;
  excerpt: string;
  confidence: number;
  sourceId?: string;
}

export interface OutreachCampaignEntity {
  id: string;
  name: string;
  description: string;
  target_icp_id: string | null;
  status: CampaignStatus;
  sending_limits: string;
  schedule_window: string;
  created_at: string;
  updated_at: string;
}

export interface OutreachCampaignDTO {
  id: string;
  name: string;
  description: string;
  targetIcpId: string | null;
  status: CampaignStatus;
  sendingLimits: { maxPerDay: number; minIntervalSeconds: number };
  scheduleWindow: { timezone: string; allowedDays: number[]; startHour: number; endHour: number };
  createdAt: string;
  updatedAt: string;
  stats?: {
    totalSequences: number;
    activeSequences: number;
    sentCount: number;
    replyCount: number;
    meetingCount: number;
    replyRate: number;
  };
}

export interface OutreachSequenceEntity {
  id: string;
  campaign_id: string | null;
  lead_id: string;
  status: SequenceStatus;
  current_step: number;
  max_steps: number;
  next_scheduled_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  stop_reason: string | null;
  lease_expires_at: string | null;
  claimed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OutreachSequenceDTO {
  id: string;
  campaignId: string | null;
  leadId: string;
  status: SequenceStatus;
  currentStep: number;
  maxSteps: number;
  nextScheduledAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  stopReason: string | null;
  leaseExpiresAt: string | null;
  claimedBy: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: OutreachMessageDTO[];
  lead?: LeadDTO;
  campaign?: OutreachCampaignDTO;
}

export interface OutreachMessageEntity {
  id: string;
  sequence_id: string;
  step_number: number;
  subject: string;
  body_html: string;
  body_text: string;
  personalization_evidence: string;
  status: OutreachMessageStatus;
  provider_message_id: string | null;
  attempt_count: number;
  scheduled_at: string | null;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface OutreachMessageDTO {
  id: string;
  sequenceId: string;
  stepNumber: number;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  personalizationEvidence: PersonalizationEvidence[];
  status: OutreachMessageStatus;
  providerMessageId: string | null;
  attemptCount: number;
  scheduledAt: string | null;
  sentAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EngagementEventEntity {
  id: string;
  lead_id: string;
  sequence_id: string | null;
  message_id: string | null;
  campaign_id: string | null;
  event_type: EngagementEventType;
  event_timestamp: string;
  provider_event_id: string | null;
  source_metadata: string;
  created_at: string;
}

export interface EngagementEventDTO {
  id: string;
  leadId: string;
  sequenceId: string | null;
  messageId: string | null;
  campaignId: string | null;
  eventType: EngagementEventType;
  eventTimestamp: string;
  providerEventId: string | null;
  sourceMetadata: Record<string, any>;
  createdAt: string;
}

export interface SuppressionEntity {
  id: string;
  email: string;
  reason: SuppressionReason;
  source: string;
  created_at: string;
}

export interface SuppressionDTO {
  id: string;
  email: string;
  reason: SuppressionReason;
  source: string;
  createdAt: string;
}

export interface CrmSyncRecordEntity {
  id: string;
  lead_id: string;
  opportunity_id: string | null;
  crm_provider: CrmProvider;
  external_contact_id: string | null;
  external_company_id: string | null;
  external_deal_id: string | null;
  sync_status: CrmSyncStatus;
  last_synced_at: string | null;
  retry_count: number;
  error_message: string | null;
  field_mappings: string;
  created_at: string;
  updated_at: string;
}

export interface CrmSyncRecordDTO {
  id: string;
  leadId: string;
  opportunityId: string | null;
  crmProvider: CrmProvider;
  externalContactId: string | null;
  externalCompanyId: string | null;
  externalDealId: string | null;
  syncStatus: CrmSyncStatus;
  lastSyncedAt: string | null;
  retryCount: number;
  errorMessage: string | null;
  fieldMappings: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface OpportunityScoreFactor {
  pillar: 'icp_fit' | 'verification' | 'engagement' | 'deal_intent';
  name: string;
  weight: number;
  rawPoints: number;
  maxPoints: number;
  contribution: number;
  summary: string;
}

export interface OpportunityScoreEntity {
  id: string;
  lead_id: string;
  opportunity_id: string | null;
  score: number;
  readiness_tier: OpportunityTier;
  factors: string;
  evidence_references: string;
  scoring_version: string;
  is_stale: number;
  evaluated_at: string;
  created_at: string;
}

export interface OpportunityScoreDTO {
  id: string;
  leadId: string;
  opportunityId: string | null;
  score: number;
  readinessTier: OpportunityTier;
  factors: OpportunityScoreFactor[];
  evidenceReferences: PersonalizationEvidence[];
  scoringVersion: string;
  isStale: boolean;
  evaluatedAt: string;
  createdAt: string;
}

export interface OutreachAnalyticsDTO {
  funnel: {
    enrolled: number;
    step1Sent: number;
    step2Sent: number;
    step3Sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    replied: number;
    bounced: number;
    unsubscribed: number;
    meetingBooked: number;
  };
  rates: {
    deliveryRate: number;
    openRate: number;
    replyRate: number;
    bounceRate: number;
    meetingRate: number;
  };
  attribution: Array<{
    sourceProvider: string;
    tier: string;
    leadCount: number;
    replyCount: number;
    replyRate: number;
    meetingCount: number;
    meetingRate: number;
  }>;
  velocity: {
    averageDaysToFirstReply: number;
    averageDaysToMeeting: number;
  };
}

export interface CrmStatusDTO {
  provider: CrmProvider;
  isConfigured: boolean;
  mode: 'real' | 'demo';
  totalSynced: number;
  pendingSync: number;
  failedSync: number;
  lastSyncedAt: string | null;
}

// ==========================================
// Phase 6A: Adaptive Source Intelligence Types
// ==========================================

export type SourceCapability =
  | 'company_discovery'
  | 'contact_discovery'
  | 'contact_verification'
  | 'hiring_signals'
  | 'technology_signals'
  | 'funding_signals'
  | 'first_party_records';

export type SourceHealthStatus = 'healthy' | 'degraded' | 'unreachable' | 'unknown';

export interface SourceCostModel {
  perRecord?: number;
  perVerification?: number;
  perCompany?: number;
  currency: string;
}

export interface SourceRateLimits {
  requestsPerMinute: number;
  dailyQuota: number;
}

export interface SourceRegistryEntity {
  id: string;
  name: string;
  provider_type: string;
  capabilities: string; // JSON string
  is_enabled: number;
  is_configured: number;
  health_status: SourceHealthStatus;
  last_health_check?: string | null;
  cost_model: string; // JSON string
  rate_limits: string; // JSON string
  metadata: string; // JSON string
  created_at: string;
  updated_at: string;
}

export interface SourceRegistryDTO {
  id: string;
  name: string;
  providerType: string;
  capabilities: SourceCapability[];
  isEnabled: boolean;
  isConfigured: boolean;
  healthStatus: SourceHealthStatus;
  lastHealthCheck?: string | null;
  costModel: SourceCostModel;
  rateLimits: SourceRateLimits;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export type SourceObservationEntityType = 'company' | 'contact' | 'signal';
export type SourceObservationStatus = 'raw' | 'normalized' | 'deduped' | 'rejected' | 'ingested';

export interface SourceObservationEntity {
  id: string;
  source_id: string;
  source_record_id?: string | null;
  entity_type: SourceObservationEntityType;
  entity_key: string;
  observed_at: string;
  retrieved_at: string;
  source_url?: string | null;
  raw_payload: string; // JSON string
  field_provenance: string; // JSON string
  fingerprint: string;
  processing_status: SourceObservationStatus;
  company_domain?: string | null;
  contact_email?: string | null;
  created_at: string;
}

export interface SourceObservationDTO {
  id: string;
  sourceId: string;
  sourceRecordId?: string | null;
  entityType: SourceObservationEntityType;
  entityKey: string;
  observedAt: string;
  retrievedAt: string;
  sourceUrl?: string | null;
  rawPayload: Record<string, any>;
  fieldProvenance: Record<string, any>;
  fingerprint: string;
  processingStatus: SourceObservationStatus;
  companyDomain?: string | null;
  contactEmail?: string | null;
  createdAt: string;
}

export type SignalCategory =
  | 'hiring'
  | 'technology'
  | 'funding'
  | 'expansion'
  | 'procurement'
  | 'first_party_intent';

export interface SourceSignalEntity {
  id: string;
  company_name: string;
  company_domain: string;
  signal_category: SignalCategory;
  source_id: string;
  source_url?: string | null;
  event_timestamp: string;
  observed_at: string;
  signal_text: string;
  structured_evidence: string; // JSON string
  confidence: number;
  relevance_score: number;
  dedup_fingerprint: string;
  created_at: string;
}

export interface SourceSignalDTO {
  id: string;
  companyName: string;
  companyDomain: string;
  signalCategory: SignalCategory;
  sourceId: string;
  sourceUrl?: string | null;
  eventTimestamp: string;
  observedAt: string;
  signalText: string;
  structuredEvidence: Record<string, any>;
  confidence: number;
  relevanceScore: number;
  dedupFingerprint: string;
  createdAt: string;
}

export type SourcingPlanStatus = 'draft' | 'approved' | 'executing' | 'completed' | 'cancelled' | 'failed';
export type SourcingJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type SourceAttributionRole = 'discovery' | 'signal' | 'contact_resolution' | 'enrichment';

export interface SelectedSourcePlanEntry {
  sourceId: string;
  sourceName: string;
  role: SourceAttributionRole;
  priority: number;
  rationale: string;
  utilityScore: number;
  estimatedCost: number;
  expectedYield: number;
}

export interface FilteringStageBlueprint {
  stageNumber: number;
  stageName: string;
  description: string;
  dropOffReason: string;
}

export interface SourcingPlanConstraints {
  maxBudget?: number;
  targetYield?: number;
  allowedSourceIds?: string[];
  requiredCapabilities?: SourceCapability[];
  minSignalConfidence?: number;
}

export interface SourcingPlanEntity {
  id: string;
  name: string;
  target_icp_id?: string | null;
  campaign_objective: string;
  constraints: string; // JSON string
  selected_sources: string; // JSON string
  stages_pipeline: string; // JSON string
  estimated_cost?: number | null;
  cost_known: number;
  expected_yield: number;
  status: SourcingPlanStatus;
  created_at: string;
  updated_at: string;
}

export interface SourcingPlanDTO {
  id: string;
  name: string;
  targetIcpId?: string | null;
  campaignObjective: string;
  constraints: SourcingPlanConstraints;
  selectedSources: SelectedSourcePlanEntry[];
  stagesPipeline: FilteringStageBlueprint[];
  estimatedCost?: number | null;
  costKnown: boolean;
  expectedYield: number;
  status: SourcingPlanStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StageExecutionMetric {
  stageNumber: number;
  stageName: string;
  inputCount: number;
  outputCount: number;
  rejectedCount: number;
  efficiencyPct: number;
  exclusionBreakdown: Record<string, number>;
  durationMs: number;
}

export interface SourcingJobEntity {
  id: string;
  plan_id: string;
  status: SourcingJobStatus;
  stage_counts: string; // JSON string
  records_sourced: number;
  records_deduped: number;
  records_screened: number;
  records_qualified: number;
  records_staged: number;
  cost_incurred: number;
  error_message?: string | null;
  claimed_by?: string | null;
  lease_expires_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SourcingJobDTO {
  id: string;
  planId: string;
  status: SourcingJobStatus;
  stageCounts: Record<string, StageExecutionMetric>;
  recordsSourced: number;
  recordsDeduped: number;
  recordsScreened: number;
  recordsQualified: number;
  recordsStaged: number;
  costIncurred: number;
  errorMessage?: string | null;
  claimedBy?: string | null;
  leaseExpiresAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SourceAttributionEntity {
  id: string;
  lead_id?: string | null;
  candidate_id?: string | null;
  source_id: string;
  role: SourceAttributionRole;
  confidence: number;
  attributed_at: string;
}

export interface SourceAttributionDTO {
  id: string;
  leadId?: string | null;
  candidateId?: string | null;
  sourceId: string;
  role: SourceAttributionRole;
  confidence: number;
  attributedAt: string;
}

export interface SourcePerformanceMetric {
  sourceId: string;
  sourceName: string;
  providerType: string;
  isConfigured: boolean;
  isEnabled: boolean;
  healthStatus: SourceHealthStatus;
  totalRequests: number;
  entitiesYielded: number;
  duplicatesDetected: number;
  duplicateRatePct: number;
  icpFitCount: number;
  icpFitRatePct: number;
  qualifiedCount: number;
  qualificationRatePct: number;
  totalCostIncurred: number;
  unitCostPerQualified: number;
  repliesAttributed: number;
  replyRatePct: number;
  meetingsAttributed: number;
  meetingRatePct: number;
  wonDealsAttributed: number;
  pipelineRevenueAttributed: number;
  recommendation: string;
}

export interface SourceIntelligenceAnalyticsDTO {
  sources: SourcePerformanceMetric[];
  totals: {
    totalEntitiesSourced: number;
    totalQualified: number;
    totalCost: number;
    averageCostPerQualified: number;
    totalPipelineRevenue: number;
  };
  signalsSummary: {
    totalSignals: number;
    categoryCounts: Record<SignalCategory, number>;
  };
}

// ==========================================
// Phase 6B: Agentic Orchestration & Self-Optimizing Sourcing
// ==========================================

export type AgenticRunStatus = 'planning' | 'approved' | 'running' | 'completed' | 'failed' | 'cancelled';
export type AgenticStepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export type AgenticToolName =
  | 'discover_companies'
  | 'fetch_business_signals'
  | 'discover_contacts'
  | 'verify_contact_email'
  | 'research_knowledge_base'
  | 'evaluate_icp_fit'
  | 'route_fallback_source';

export interface ParsedCampaignIntent {
  campaignObjective: string;
  targetGeography?: string;
  targetIndustries: string[];
  companySizeRanges: string[];
  targetRoles: string[];
  buyingTriggers: string[];
  signalCategories: SignalCategory[];
  desiredCompanyCount: number;
  budgetLimit: number;
  stopConditions: string[];
  recommendedSources: string[];
  unsupportedRequirements: string[];
  interpretationMode: 'llm_parsed' | 'deterministic_fallback';
}

export interface AgenticSourcingStepEntity {
  id: string;
  run_id: string;
  step_number: number;
  tool_name: AgenticToolName;
  tool_input: string; // JSON
  tool_output: string; // JSON
  rationale: string;
  status: AgenticStepStatus;
  cost_incurred: number;
  duration_ms: number;
  created_at: string;
}

export interface AgenticSourcingStepDTO {
  id: string;
  runId: string;
  stepNumber: number;
  toolName: AgenticToolName;
  toolInput: Record<string, any>;
  toolOutput: Record<string, any>;
  rationale: string;
  status: AgenticStepStatus;
  costIncurred: number;
  durationMs: number;
  createdAt: string;
}

export interface AgenticSourcingRunEntity {
  id: string;
  name: string;
  natural_language_intent: string;
  target_icp_id?: string | null;
  plan_id?: string | null;
  status: AgenticRunStatus;
  budget_limit: number;
  budget_spent: number;
  target_yield: number;
  yield_achieved: number;
  efficiency_score: number;
  execution_strategy: string; // JSON
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgenticSourcingRunDTO {
  id: string;
  name: string;
  naturalLanguageIntent: string;
  targetIcpId?: string | null;
  planId?: string | null;
  status: AgenticRunStatus;
  budgetLimit: number;
  budgetSpent: number;
  targetYield: number;
  yieldAchieved: number;
  efficiencyScore: number;
  executionStrategy: Record<string, any>;
  errorMessage?: string | null;
  steps: AgenticSourcingStepDTO[];
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SourcingOptimizationWeightEntity {
  id: string;
  source_id: string;
  empirical_yield_rate: number;
  empirical_duplicate_rate: number;
  empirical_reply_rate: number;
  empirical_meeting_rate: number;
  quality_multiplier: number;
  learned_cost_efficiency: number;
  total_leads_attributed: number;
  total_meetings_attributed: number;
  total_pipeline_attributed: number;
  last_optimized_at: string;
  updated_at: string;
}

export interface SourcingOptimizationWeightDTO {
  id: string;
  sourceId: string;
  sourceName?: string;
  empiricalYieldRate: number;
  empiricalDuplicateRate: number;
  empiricalReplyRate: number;
  empiricalMeetingRate: number;
  qualityMultiplier: number;
  learnedCostEfficiency: number;
  totalLeadsAttributed: number;
  totalMeetingsAttributed: number;
  totalPipelineAttributed: number;
  lastOptimizedAt: string;
  updatedAt: string;
}

export interface SourcingExperimentEntity {
  id: string;
  name: string;
  description: string;
  status: 'running' | 'completed' | 'failed';
  baseline_strategy: string;
  agentic_strategy: string;
  sample_size: number;
  baseline_metrics: string; // JSON
  agentic_metrics: string; // JSON
  uplift_summary: string; // JSON
  concluded_at: string;
  created_at: string;
}

export interface ExperimentStrategyMetrics {
  yieldCount: number;
  yieldRatePct: number;
  totalCost: number;
  unitCost: number;
  efficiencyPct: number;
  durationMs: number;
  meetingRatePct: number;
}

export interface ExperimentUpliftSummary {
  yieldUpliftPct: number;
  costReductionPct: number;
  efficiencyGainPct: number;
  netRoiImprovement: string;
}

export interface SourcingExperimentDTO {
  id: string;
  name: string;
  description: string;
  status: 'running' | 'completed' | 'failed';
  baselineStrategy: string;
  agenticStrategy: string;
  sampleSize: number;
  baselineMetrics: ExperimentStrategyMetrics;
  agenticMetrics: ExperimentStrategyMetrics;
  upliftSummary: ExperimentUpliftSummary;
  concludedAt: string;
  createdAt: string;
}

export interface AgenticSourcingStatusDTO {
  enabled: boolean;
  sourceIntelligenceEnabled: boolean;
  aiConfigured: boolean;
  activeRunsCount: number;
  completedRunsCount: number;
  optimizationWeightsCount: number;
  experimentsCount: number;
}



