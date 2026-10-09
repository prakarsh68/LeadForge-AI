export type ViewType = 'dashboard' | 'icp' | 'discovery' | 'leads' | 'pipeline' | 'knowledge';

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

export interface DiscoveryJob {
  id: string;
  provider: string;
  mode: DiscoveryMode;
  status: 'pending' | 'running' | 'completed' | 'failed';
  queryParams: Record<string, any>;
  totalFound: number;
  errorMessage?: string | null;
  createdAt: string;
  completedAt?: string | null;
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

export interface KnowledgeDocument {
  id: string;
  title: string;
  category: 'Product Specs' | 'Battlecards' | 'Case Studies' | 'Pricing' | 'Compliance';
  type: 'pdf' | 'doc' | 'url' | 'notion';
  sizeOrTokens: string;
  status: 'Indexed' | 'Syncing' | 'Ready';
  uploadedAt: string;
  summary: string;
}

export interface PipelineColumn {
  id: LeadStatus;
  title: string;
  color: string;
}

