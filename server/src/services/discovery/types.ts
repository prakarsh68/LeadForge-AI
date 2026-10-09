import type {
  VerificationStatus,
  FieldProvenance,
  DiscoveryMode,
} from '../../types/index.js';

export class ProviderAuthError extends Error {
  constructor(message: string = 'Provider authentication failed. Invalid or expired API credentials.') {
    super(message);
    this.name = 'ProviderAuthError';
  }
}

export class ProviderRateLimitError extends Error {
  constructor(message: string = 'Provider rate limit or quota exceeded.') {
    super(message);
    this.name = 'ProviderRateLimitError';
  }
}

export class ProviderTimeoutError extends Error {
  constructor(message: string = 'Provider request timed out.') {
    super(message);
    this.name = 'ProviderTimeoutError';
  }
}

export class ProviderApiError extends Error {
  public status?: number;
  public details?: any;

  constructor(message: string, status?: number, details?: any) {
    super(message);
    this.name = 'ProviderApiError';
    this.status = status;
    this.details = details;
  }
}

export interface PeopleDiscoveryQuery {
  domain: string;
  targetRoles?: string[];
  seniorityLevels?: string[];
  limit?: number;
}

export interface DiscoveredPersonCandidate {
  externalId?: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  title: string;
  email?: string;
  emailVerification: VerificationStatus;
  confidence?: number;
  linkedinUrl?: string;
  companyName: string;
  companyDomain: string;
  industry?: string;
  companySize?: string;
  location?: string;
  sourceUrls: string[];
  rawPayload: Record<string, any>;
  fieldProvenance: Record<string, FieldProvenance>;
  isMock: boolean;
}

export interface DiscoveryProvider {
  readonly id: string;
  readonly displayName: string;
  readonly mode: DiscoveryMode;
  readonly description: string;
  readonly capabilities: string[];
  isConfigured(): boolean;

  searchDomain(query: PeopleDiscoveryQuery): Promise<DiscoveredPersonCandidate[]>;
}
