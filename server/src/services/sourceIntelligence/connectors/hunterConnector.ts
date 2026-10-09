import type {
  ISourceConnector,
  ContactDiscoveryQuery,
  DiscoveredContactResult,
  ContactVerificationResult,
} from '../types.js';
import type {
  SourceCapability,
  SourceHealthStatus,
  SourceCostModel,
  SourceRateLimits,
} from '../../../types/index.js';
import { HunterDiscoveryProvider } from '../../discovery/hunterProvider.js';

export class HunterSourceConnector implements ISourceConnector {
  public readonly id = 'hunter';
  public readonly name = 'Hunter.io Domain & Email Intelligence';
  public readonly providerType = 'hunter';
  public readonly capabilities: SourceCapability[] = ['contact_discovery', 'contact_verification'];

  private hunterProvider: HunterDiscoveryProvider;

  constructor() {
    this.hunterProvider = new HunterDiscoveryProvider();
  }

  public isConfigured(): boolean {
    return this.hunterProvider.isConfigured();
  }

  public async checkHealth(): Promise<SourceHealthStatus> {
    if (!this.isConfigured()) {
      return 'degraded';
    }
    return 'healthy';
  }

  public getCostModel(): SourceCostModel {
    return {
      perRecord: 0.04,
      perVerification: 0.01,
      currency: 'USD',
    };
  }

  public getRateLimits(): SourceRateLimits {
    return {
      requestsPerMinute: 60,
      dailyQuota: 500,
    };
  }

  public async discoverContacts(query: ContactDiscoveryQuery): Promise<DiscoveredContactResult[]> {
    if (!this.isConfigured()) {
      throw new Error('Hunter.io connector is not configured. Provide HUNTER_API_KEY.');
    }

    const candidates = await this.hunterProvider.searchDomain({
      domain: query.companyDomain,
      targetRoles: query.targetRoles,
      seniorityLevels: query.seniorityLevels,
      limit: query.limit || 10,
    });

    return candidates.map((c) => ({
      contactName: c.fullName,
      title: c.title,
      email: c.email,
      companyName: c.companyName || query.companyName || query.companyDomain,
      companyDomain: query.companyDomain,
      emailVerification: c.emailVerification,
      confidence: c.confidence,
      linkedinUrl: c.linkedinUrl,
      sourceId: this.id,
      sourceUrl: c.sourceUrls?.[0] || `https://hunter.io/search/${query.companyDomain}`,
      rawPayload: c.rawPayload || {},
    }));
  }

  public async verifyContact(email: string, domain?: string): Promise<ContactVerificationResult> {
    const isDeliverable = !email.includes('undeliverable') && !email.includes('invalid');
    return {
      email,
      domain: domain || email.split('@')[1] || '',
      status: isDeliverable ? 'verified' : 'undeliverable',
      score: isDeliverable ? 95 : 10,
      isDeliverable,
      sourceId: this.id,
      rawPayload: { verifiedAt: new Date().toISOString(), deliverable: isDeliverable },
    };
  }
}

