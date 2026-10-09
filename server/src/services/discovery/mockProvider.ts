import type {
  DiscoveryProvider,
  PeopleDiscoveryQuery,
  DiscoveredPersonCandidate,
} from './types.js';
import type { DiscoveryMode, FieldProvenance } from '../../types/index.js';

interface SeedCompany {
  organization: string;
  industry: string;
  companySize: string;
  location: string;
  people: Array<{
    firstName: string;
    lastName: string;
    position: string;
    emailUser: string;
    confidence: number;
    verificationStatus: 'verified' | 'unverified' | 'risky';
    linkedinSlug: string;
    sourceUri: string;
  }>;
}

const SEED_CATALOG: Record<string, SeedCompany> = {
  'stripe.com': {
    organization: 'Stripe',
    industry: 'FinTech & Payments',
    companySize: '5,000 - 10,000',
    location: 'South San Francisco, CA',
    people: [
      {
        firstName: 'Claire',
        lastName: 'Hughes Johnson',
        position: 'Corporate Officer & Executive Advisor',
        emailUser: 'claire',
        confidence: 96,
        verificationStatus: 'verified',
        linkedinSlug: 'claire-hughes-johnson',
        sourceUri: 'https://stripe.com/about',
      },
      {
        firstName: 'Will',
        lastName: 'Gaybrick',
        position: 'Chief Product Officer',
        emailUser: 'will.g',
        confidence: 92,
        verificationStatus: 'verified',
        linkedinSlug: 'willgaybrick',
        sourceUri: 'https://stripe.com/newsroom',
      },
      {
        firstName: 'David',
        lastName: 'Singleton',
        position: 'Chief Technology Officer',
        emailUser: 'dave',
        confidence: 89,
        verificationStatus: 'verified',
        linkedinSlug: 'davidsingleton',
        sourceUri: 'https://github.com/stripe',
      },
      {
        firstName: 'Eileen',
        lastName: 'O\'Mara',
        position: 'Chief Revenue Officer',
        emailUser: 'eileen.omara',
        confidence: 94,
        verificationStatus: 'verified',
        linkedinSlug: 'eileen-omara',
        sourceUri: 'https://stripe.com/press',
      },
    ],
  },
  'ramp.com': {
    organization: 'Ramp',
    industry: 'FinTech & Payments',
    companySize: '500 - 1,000',
    location: 'New York, NY',
    people: [
      {
        firstName: 'Eric',
        lastName: 'Glyman',
        position: 'Chief Executive Officer & Co-Founder',
        emailUser: 'eglyman',
        confidence: 98,
        verificationStatus: 'verified',
        linkedinSlug: 'ericglyman',
        sourceUri: 'https://ramp.com/leadership',
      },
      {
        firstName: 'Colin',
        lastName: 'Kennedy',
        position: 'Chief Business Officer',
        emailUser: 'colin.k',
        confidence: 91,
        verificationStatus: 'verified',
        linkedinSlug: 'colinkennedy',
        sourceUri: 'https://ramp.com/press',
      },
      {
        firstName: 'Megan',
        lastName: 'Stangel',
        position: 'Head of Sales & Account Executive Leadership',
        emailUser: 'megan.s',
        confidence: 88,
        verificationStatus: 'verified',
        linkedinSlug: 'megan-stangel',
        sourceUri: 'https://ramp.com/careers',
      },
    ],
  },
  'cloudscale.io': {
    organization: 'CloudScale Nexus',
    industry: 'Enterprise Software & Cloud',
    companySize: '250 - 500',
    location: 'San Francisco, CA',
    people: [
      {
        firstName: 'Elena',
        lastName: 'Rostova',
        position: 'VP of Sales & Revenue Operations',
        emailUser: 'elena.rostova',
        confidence: 95,
        verificationStatus: 'verified',
        linkedinSlug: 'elena-rostova-mock',
        sourceUri: 'https://cloudscale.io/team',
      },
      {
        firstName: 'Tariq',
        lastName: 'Al-Mansoor',
        position: 'VP of Product Engineering',
        emailUser: 'tariq.m',
        confidence: 86,
        verificationStatus: 'verified',
        linkedinSlug: 'tariq-almansoor',
        sourceUri: 'https://cloudscale.io/engineering',
      },
    ],
  },
};

export class MockDiscoveryProvider implements DiscoveryProvider {
  public readonly id = 'mock';
  public readonly displayName = 'LeadForge Sandbox / Demo Discovery';
  public readonly mode: DiscoveryMode = 'demo';
  public readonly description = 'Deterministic local demo dataset for offline testing, sandboxing, and evaluation.';
  public readonly capabilities = ['domain_search', 'email_verification', 'source_citations'];

  public isConfigured(): boolean {
    return true; // Demo provider is always available
  }

  public async searchDomain(query: PeopleDiscoveryQuery): Promise<DiscoveredPersonCandidate[]> {
    const domainNorm = query.domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    const retrievedAt = new Date().toISOString();
    const limit = Math.max(1, Math.min(query.limit || 10, 50));

    // Check if domain is in our pre-configured seed catalog
    const seed = SEED_CATALOG[domainNorm];

    if (!seed) {
      // Generate a deterministic synthetic demo set for the unrecognized domain
      const companyName = domainNorm.split('.')[0].replace(/-/g, ' ');
      const capitalizedCompany = companyName.charAt(0).toUpperCase() + companyName.slice(1);

      const demoRoles = [
        { first: 'Alex', last: 'Morgan', title: 'VP of Sales & Business Development' },
        { first: 'Jordan', last: 'Lee', title: 'Director of Revenue Operations' },
        { first: 'Taylor', last: 'Smith', title: 'Chief Commercial Officer' },
      ];

      return demoRoles.slice(0, limit).map((r, idx) => {
        const email = `${r.first.toLowerCase()}.${r.last.toLowerCase()}@${domainNorm}`;
        const sourceUrl = `https://${domainNorm}/about`;

        const provenance: Record<string, FieldProvenance> = {
          name: {
            fieldName: 'name',
            value: `${r.first} ${r.last}`,
            sourceProvider: 'mock',
            sourceUrl,
            retrievedAt,
            verificationStatus: 'unverified',
          },
          email: {
            fieldName: 'email',
            value: email,
            sourceProvider: 'mock',
            sourceUrl,
            retrievedAt,
            verificationStatus: 'unverified',
            confidence: 75,
          },
          title: {
            fieldName: 'title',
            value: r.title,
            sourceProvider: 'mock',
            sourceUrl,
            retrievedAt,
            verificationStatus: 'inferred',
          },
          company: {
            fieldName: 'company',
            value: capitalizedCompany,
            sourceProvider: 'mock',
            sourceUrl,
            retrievedAt,
            verificationStatus: 'unverified',
          },
        };

        return {
          externalId: `mock-${domainNorm}-${idx + 1}`,
          firstName: r.first,
          lastName: r.last,
          fullName: `${r.first} ${r.last}`,
          title: r.title,
          email,
          emailVerification: 'unverified',
          confidence: 75,
          linkedinUrl: `https://linkedin.com/in/${r.first.toLowerCase()}-${r.last.toLowerCase()}-demo`,
          companyName: capitalizedCompany,
          companyDomain: domainNorm,
          industry: 'Enterprise Software & Cloud',
          companySize: '100 - 250',
          location: 'United States',
          sourceUrls: [sourceUrl],
          rawPayload: { demoMode: true, index: idx },
          fieldProvenance: provenance,
          isMock: true,
        };
      });
    }

    // Process from seed catalog
    let people = seed.people;
    if (query.targetRoles && query.targetRoles.length > 0) {
      const rolesLower = query.targetRoles.map((r) => r.toLowerCase());
      const filtered = people.filter((p) => rolesLower.some((role) => p.position.toLowerCase().includes(role)));
      if (filtered.length > 0) people = filtered;
    }

    return people.slice(0, limit).map((p, idx) => {
      const email = `${p.emailUser}@${domainNorm}`;
      const fullName = `${p.firstName} ${p.lastName}`;

      const provenance: Record<string, FieldProvenance> = {
        name: {
          fieldName: 'name',
          value: fullName,
          sourceProvider: 'mock',
          sourceUrl: p.sourceUri,
          retrievedAt,
          verificationStatus: 'verified',
        },
        email: {
          fieldName: 'email',
          value: email,
          sourceProvider: 'mock',
          sourceUrl: p.sourceUri,
          retrievedAt,
          verificationStatus: p.verificationStatus,
          confidence: p.confidence,
        },
        title: {
          fieldName: 'title',
          value: p.position,
          sourceProvider: 'mock',
          sourceUrl: p.sourceUri,
          retrievedAt,
          verificationStatus: 'verified',
        },
        company: {
          fieldName: 'company',
          value: seed.organization,
          sourceProvider: 'mock',
          sourceUrl: `https://${domainNorm}`,
          retrievedAt,
          verificationStatus: 'verified',
        },
      };

      return {
        externalId: `mock-${domainNorm}-${idx + 1}`,
        firstName: p.firstName,
        lastName: p.lastName,
        fullName,
        title: p.position,
        email,
        emailVerification: p.verificationStatus,
        confidence: p.confidence,
        linkedinUrl: `https://linkedin.com/in/${p.linkedinSlug}`,
        companyName: seed.organization,
        companyDomain: domainNorm,
        industry: seed.industry,
        companySize: seed.companySize,
        location: seed.location,
        sourceUrls: [p.sourceUri],
        rawPayload: { seedData: true, domain: domainNorm },
        fieldProvenance: provenance,
        isMock: true,
      };
    });
  }
}
