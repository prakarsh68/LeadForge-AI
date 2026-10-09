import type {
  SourceCapability,
  SourceHealthStatus,
  SourceCostModel,
  SourceRateLimits,
  SignalCategory,
  VerificationStatus,
} from '../../types/index.js';

export interface DiscoveredCompanyResult {
  companyName: string;
  companyDomain: string;
  industry?: string;
  companySize?: string;
  location?: string;
  website?: string;
  sourceId: string;
  sourceUrl?: string;
  rawPayload: Record<string, any>;
  confidence: number;
}

export interface DiscoveredContactResult {
  contactName: string;
  title: string;
  email?: string;
  companyName: string;
  companyDomain: string;
  emailVerification: VerificationStatus;
  confidence?: number;
  linkedinUrl?: string;
  sourceId: string;
  sourceUrl?: string;
  rawPayload: Record<string, any>;
}

export interface DiscoveredSignalResult {
  companyName: string;
  companyDomain: string;
  signalCategory: SignalCategory;
  signalText: string;
  structuredEvidence: Record<string, any>;
  eventTimestamp: string;
  sourceId: string;
  sourceUrl?: string;
  confidence: number;
  relevanceScore: number;
  rawPayload: Record<string, any>;
}

export interface CompanyDiscoveryQuery {
  targetIndustries?: string[];
  targetLocations?: string[];
  companySizeRanges?: string[];
  keywords?: string[];
  limit?: number;
}

export interface ContactDiscoveryQuery {
  companyDomain: string;
  companyName?: string;
  targetRoles?: string[];
  seniorityLevels?: string[];
  limit?: number;
}

export interface SignalQuery {
  companyDomain?: string;
  companyName?: string;
  signalCategories?: SignalCategory[];
  keywords?: string[];
  minConfidence?: number;
  limit?: number;
}

export interface ContactVerificationResult {
  email: string;
  domain: string;
  status: VerificationStatus;
  score: number;
  isDeliverable: boolean;
  sourceId: string;
  rawPayload: Record<string, any>;
}

export interface ISourceConnector {
  readonly id: string;
  readonly name: string;
  readonly providerType: string;
  readonly capabilities: SourceCapability[];

  isConfigured(): boolean;
  checkHealth(): Promise<SourceHealthStatus>;
  getCostModel(): SourceCostModel;
  getRateLimits(): SourceRateLimits;

  discoverCompanies?(query: CompanyDiscoveryQuery): Promise<DiscoveredCompanyResult[]>;
  discoverContacts?(query: ContactDiscoveryQuery): Promise<DiscoveredContactResult[]>;
  verifyContact?(email: string, domain?: string): Promise<ContactVerificationResult>;
  fetchSignals?(query: SignalQuery): Promise<DiscoveredSignalResult[]>;
}

export interface SourceEligibilityResult {
  sourceId: string;
  eligible: boolean;
  reasons: string[];
}

