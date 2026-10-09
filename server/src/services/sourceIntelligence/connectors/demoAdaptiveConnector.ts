import type {
  ISourceConnector,
  CompanyDiscoveryQuery,
  DiscoveredCompanyResult,
  ContactDiscoveryQuery,
  DiscoveredContactResult,
  SignalQuery,
  DiscoveredSignalResult,
  ContactVerificationResult,
} from '../types.js';
import type {
  SourceCapability,
  SourceHealthStatus,
  SourceCostModel,
  SourceRateLimits,
} from '../../../types/index.js';

export class DemoAdaptiveSignalsConnector implements ISourceConnector {
  public readonly id = 'demo_adaptive_source';
  public readonly name = 'Adaptive Demo Multi-Signal Provider';
  public readonly providerType = 'demo_signals';
  public readonly capabilities: SourceCapability[] = [
    'company_discovery',
    'contact_discovery',
    'hiring_signals',
    'technology_signals',
    'funding_signals',
  ];

  public isConfigured(): boolean {
    return true;
  }

  public async checkHealth(): Promise<SourceHealthStatus> {
    return 'healthy';
  }

  public getCostModel(): SourceCostModel {
    return {
      perRecord: 0.00,
      perVerification: 0.00,
      currency: 'USD',
    };
  }

  public getRateLimits(): SourceRateLimits {
    return {
      requestsPerMinute: 1000,
      dailyQuota: 100000,
    };
  }

  public async discoverCompanies(_query: CompanyDiscoveryQuery): Promise<DiscoveredCompanyResult[]> {
    return [
      {
        companyName: 'OmniStream Cloud',
        companyDomain: 'omnistream.io',
        industry: 'Enterprise Software & Cloud',
        companySize: '100 - 250',
        location: 'San Francisco, CA',
        sourceId: this.id,
        sourceUrl: 'https://demo.leadforge.internal/companies/omnistream.io',
        rawPayload: { mode: 'demo' },
        confidence: 0.95,
      },
      {
        companyName: 'DataVanguard AI',
        companyDomain: 'datavanguard.ai',
        industry: 'AI & Data Analytics',
        companySize: '250 - 500',
        location: 'New York, NY',
        sourceId: this.id,
        sourceUrl: 'https://demo.leadforge.internal/companies/datavanguard.ai',
        rawPayload: { mode: 'demo' },
        confidence: 0.93,
      },
      {
        companyName: 'PayShield Global',
        companyDomain: 'payshield.co',
        industry: 'FinTech & Payments',
        companySize: '500 - 1,000',
        location: 'London, UK',
        sourceId: this.id,
        sourceUrl: 'https://demo.leadforge.internal/companies/payshield.co',
        rawPayload: { mode: 'demo' },
        confidence: 0.92,
      },
      {
        companyName: 'CyberGuard Systems',
        companyDomain: 'cyberguard-sec.io',
        industry: 'Cybersecurity',
        companySize: '50 - 100',
        location: 'Boston, MA',
        sourceId: this.id,
        sourceUrl: 'https://demo.leadforge.internal/companies/cyberguard-sec.io',
        rawPayload: { mode: 'demo' },
        confidence: 0.90,
      },
    ];
  }

  public async discoverContacts(query: ContactDiscoveryQuery): Promise<DiscoveredContactResult[]> {
    const domain = query.companyDomain.toLowerCase();
    const demoContactsByDomain: Record<string, DiscoveredContactResult[]> = {
      'omnistream.io': [
        {
          contactName: 'Chloe Bennett',
          title: 'VP of Sales & Revenue Operations',
          email: 'chloe.bennett@omnistream.io',
          companyName: 'OmniStream Cloud',
          companyDomain: 'omnistream.io',
          emailVerification: 'verified',
          confidence: 96,
          linkedinUrl: 'https://linkedin.com/in/chloe-bennett-demo',
          sourceId: this.id,
          sourceUrl: 'https://demo.leadforge.internal/contacts/chloe',
          rawPayload: {
            isDemo: true,
            industry: 'Enterprise Software & Cloud',
            companySize: '100 - 250',
            location: 'San Francisco, CA',
            triggers: [
              'Hiring 6 Enterprise SDRs and RevOps Manager for Q3 Expansion',
              'Closed $20M Series A Growth Round',
              'Tech stack: Salesforce CRM and Snowflake Cloud Data',
            ],
          },
        },
      ],
      'datavanguard.ai': [
        {
          contactName: 'Arthur Vance',
          title: 'Chief Commercial Officer',
          email: 'arthur.vance@datavanguard.ai',
          companyName: 'DataVanguard AI',
          companyDomain: 'datavanguard.ai',
          emailVerification: 'verified',
          confidence: 94,
          linkedinUrl: 'https://linkedin.com/in/arthur-vance-demo',
          sourceId: this.id,
          sourceUrl: 'https://demo.leadforge.internal/contacts/arthur',
          rawPayload: {
            isDemo: true,
            industry: 'AI & Data Analytics',
            companySize: '250 - 500',
            location: 'New York, NY',
            triggers: [
              'Secured $32M Series B round for Enterprise AI Data Orchestration',
              'Scaling Outbound Enterprise Sales Team',
              'Tech stack: Salesforce, Snowflake, AWS',
            ],
          },
        },
      ],
      'payshield.co': [
        {
          contactName: 'Morgan Rivera',
          title: 'Head of Growth',
          email: 'morgan.r@payshield.co',
          companyName: 'PayShield Global',
          companyDomain: 'payshield.co',
          emailVerification: 'verified',
          confidence: 91,
          linkedinUrl: 'https://linkedin.com/in/morgan-rivera-demo',
          sourceId: this.id,
          sourceUrl: 'https://demo.leadforge.internal/contacts/morgan',
          rawPayload: {
            isDemo: true,
            industry: 'FinTech & Payments',
            companySize: '500 - 1,000',
            location: 'London, UK',
            triggers: ['Integrated HubSpot and Salesforce CRM with multi-region AWS settlement cluster'],
          },
        },
      ],
    };

    if (demoContactsByDomain[domain]) {
      return demoContactsByDomain[domain];
    }

    return [
      {
        contactName: 'Alex Mercer',
        title: 'Director of Business Development',
        email: `alex.mercer@${domain}`,
        companyName: query.companyName || domain,
        companyDomain: domain,
        emailVerification: 'verified',
        confidence: 88,
        linkedinUrl: `https://linkedin.com/in/alex-mercer-${domain}`,
        sourceId: this.id,
        sourceUrl: `https://demo.leadforge.internal/contacts/${domain}`,
        rawPayload: { isDemo: true },
      },
    ];
  }

  public async verifyContact(email: string, domain?: string): Promise<ContactVerificationResult> {
    return {
      email,
      domain: domain || email.split('@')[1] || '',
      status: 'verified',
      score: 98,
      isDeliverable: true,
      sourceId: this.id,
      rawPayload: { isDemo: true, deliverable: true },
    };
  }

  public async fetchSignals(query: SignalQuery): Promise<DiscoveredSignalResult[]> {
    const signals: DiscoveredSignalResult[] = [
      {
        companyName: 'OmniStream Cloud',
        companyDomain: 'omnistream.io',
        signalCategory: 'hiring',
        signalText: 'Hiring 6 Enterprise SDRs and RevOps Manager for Q3 Expansion',
        structuredEvidence: { headcountTarget: 6, roles: ['Enterprise SDR', 'RevOps Manager'] },
        eventTimestamp: new Date().toISOString(),
        sourceId: this.id,
        sourceUrl: 'https://demo.leadforge.internal/signals/omnistream-hiring',
        confidence: 0.96,
        relevanceScore: 94,
        rawPayload: { isDemo: true },
      },
      {
        companyName: 'DataVanguard AI',
        companyDomain: 'datavanguard.ai',
        signalCategory: 'funding',
        signalText: 'Secured $32M Series B round for Enterprise AI Data Orchestration',
        structuredEvidence: { round: 'Series B', amount: 32000000, currency: 'USD' },
        eventTimestamp: new Date().toISOString(),
        sourceId: this.id,
        sourceUrl: 'https://demo.leadforge.internal/signals/datavanguard-funding',
        confidence: 0.98,
        relevanceScore: 95,
        rawPayload: { isDemo: true },
      },
      {
        companyName: 'PayShield Global',
        companyDomain: 'payshield.co',
        signalCategory: 'technology',
        signalText: 'Integrated HubSpot and Salesforce CRM with multi-region AWS settlement cluster',
        structuredEvidence: { stack: ['HubSpot', 'Salesforce', 'AWS'] },
        eventTimestamp: new Date().toISOString(),
        sourceId: this.id,
        sourceUrl: 'https://demo.leadforge.internal/signals/payshield-tech',
        confidence: 0.93,
        relevanceScore: 89,
        rawPayload: { isDemo: true },
      },
    ];

    if (query.companyDomain) {
      return signals.filter((s) => s.companyDomain.toLowerCase() === query.companyDomain!.toLowerCase());
    }

    return signals;
  }
}
