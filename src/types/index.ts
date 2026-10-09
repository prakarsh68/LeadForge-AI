export type ViewType = 'dashboard' | 'icp' | 'discovery' | 'leads' | 'pipeline' | 'knowledge' | 'outreach';

export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Proposal' | 'Won' | 'Disqualified';

export type LeadScoreTier = 'high' | 'medium' | 'low';

export interface Lead {
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
  isMock?: boolean;
  isQualificationStale?: boolean;
  enrichedAt?: string | null;
  lastQualificationError?: string | null;
  conflictHistory?: FieldConflict[];
  enrichmentProvenance?: Record<string, FieldProvenance> | null;
  createdAt?: string;
  updatedAt?: string;
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
export type DiscoveryMode = 'real' | 'demo';

export interface DiscoveryProviderStatus {
  id: string;
  displayName: string;
  mode: DiscoveryMode;
  isConfigured: boolean;
  description: string;
  capabilities: string[];
}

export type DiscoveryJobStatus = 'queued' | 'pending' | 'running' | 'completed' | 'partially_completed' | 'failed' | 'cancelled';

export interface DiscoveryJob {
  id: string;
  provider: string;
  mode: DiscoveryMode;
  status: DiscoveryJobStatus;
  queryParams: Record<string, any>;
  totalFound: number;
  candidatesFound?: number;
  candidatesProcessed?: number;
  candidatesIngested?: number;
  candidatesSkipped?: number;
  candidatesFailed?: number;
  errorMessage?: string | null;
  lastErrorCategory?: string | null;
  attemptCount?: number;
  maxRetries?: number;
  retryCount?: number;
  nextRetryAt?: string | null;
  cancelRequestedAt?: string | null;
  claimedBy?: string | null;
  claimedAt?: string | null;
  leaseExpiresAt?: string | null;
  startedAt?: string | null;
  createdAt: string;
  completedAt?: string | null;
  updatedAt?: string;
}

export interface FieldProvenance<T = any> {
  fieldName: string;
  value: T;
  sourceProvider: string;
  sourceUrl?: string | null;
  retrievedAt: string;
  verificationStatus: VerificationStatus;
  confidence?: number | null;
}

export interface DiscoveredCandidate {
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
  provenanceMetadata?: Record<string, FieldProvenance>;
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

export interface IngestBatchResult {
  ingested: Array<{ lead: Lead; candidateId: string }>;
  skipped: Array<{ candidateId: string; reason: string }>;
  failed: Array<{ candidateId: string; error: string }>;
  counts: { total: number; ingested: number; skipped: number; failed: number };
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

export interface ActivityItem {
  id: string;
  type: 'discovery' | 'score' | 'outreach' | 'stage_change';
  title: string;
  description: string;
  timestamp: string;
  badge?: string;
  createdAt?: string;
}

export interface KpiMetric {
  id: string;
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  subtitle: string;
}

export interface IcpProfile {
  id?: string;
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
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Opportunity {
  id: string;
  leadId: string;
  title: string;
  stage: LeadStatus;
  dealValue: number;
  confidenceScore: number;
  expectedCloseDate: string | null;
  createdAt?: string;
  updatedAt?: string;
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

export interface PipelineSummary {
  totalPipelineValue: number;
  totalOpportunities: number;
  stageCounts: Record<LeadStatus, number>;
  stageValues: Record<LeadStatus, number>;
  winRate: number;
  averageDealValue: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  meta?: Record<string, any>;
  message?: string;
  error?: string;
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

export interface KnowledgeDocument {
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
}

export interface KnowledgeChunk {
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

export interface KnowledgeConfig {
  aiConfigured: boolean;
  embeddingModel: string;
  chatModel: string;
  baseUrl: string;
  totalDocuments: number;
  totalChunks: number;
  totalEmbeddedChunks: number;
}

export interface PipelineColumn {
  id: LeadStatus;
  title: string;
  color: string;
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

export interface OutreachCampaign {
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

export interface OutreachSequence {
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
  messages?: OutreachMessage[];
  lead?: Lead;
  campaign?: OutreachCampaign;
}

export interface OutreachMessage {
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

export interface EngagementEvent {
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

export interface SuppressionItem {
  id: string;
  email: string;
  reason: SuppressionReason;
  source: string;
  createdAt: string;
}

export interface CrmSyncRecord {
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

export interface OpportunityScore {
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

export interface OutreachAnalytics {
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

export interface CrmStatus {
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

export interface SourceRegistryItem {
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

export type SignalCategory =
  | 'hiring'
  | 'technology'
  | 'funding'
  | 'expansion'
  | 'procurement'
  | 'first_party_intent';

export interface SourceSignal {
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

export interface SourcingPlan {
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

export interface SourcingJob {
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

export interface SourceIntelligenceAnalytics {
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
// Phase 6B: Agentic Orchestration Types
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

export interface AgenticSourcingStep {
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

export interface AgenticSourcingRun {
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
  steps: AgenticSourcingStep[];
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SourcingOptimizationWeight {
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

export interface SourcingExperiment {
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

export interface AgenticSourcingStatus {
  enabled: boolean;
  sourceIntelligenceEnabled: boolean;
  aiConfigured: boolean;
  activeRunsCount: number;
  completedRunsCount: number;
  optimizationWeightsCount: number;
  experimentsCount: number;
}



