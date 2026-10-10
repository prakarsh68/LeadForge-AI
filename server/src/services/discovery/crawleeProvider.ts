import type { DiscoveryProvider, PeopleDiscoveryQuery, DiscoveredPersonCandidate } from './types.js';
import type { DiscoveryMode } from '../../types/index.js';
import { CrawleeCrawlRunnerService } from './crawleeCrawlRunnerService.js';
import { CrawlProfileService } from './crawlProfileService.js';

export class CrawleeDiscoveryProvider implements DiscoveryProvider {
  public readonly id = 'crawlee_web';
  public readonly displayName = 'Crawlee Open-Source Web Crawler';
  public readonly mode: DiscoveryMode = 'real';
  public readonly description =
    'Open-source web crawler powered by Crawlee & Cheerio. Fetches permitted public company pages to extract real corporate information, leadership, and public business contacts.';
  public readonly capabilities = [
    'company_discovery',
    'domain_search',
    'web_crawling',
    'hiring_signals',
    'technology_signals',
    'public_contact_extraction',
  ];

  public isConfigured(): boolean {
    // Configured if at least one active source profile is defined, or can accept dynamic domains
    const profiles = CrawlProfileService.getAllProfiles();
    return profiles.some((p) => p.isActive) || true;
  }

  public async searchDomain(query: PeopleDiscoveryQuery): Promise<DiscoveredPersonCandidate[]> {
    const domain = query.domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
    const limit = Math.max(1, Math.min(query.limit || 10, 25));

    // Execute real Crawlee crawl
    const crawlResult = await CrawleeCrawlRunnerService.executeCrawl({
      jobId: query.jobId,
      profileId: query.profileId,
      customDomain: domain,
      maxPages: limit,
      crawlDepth: 2,
      stageCandidates: false,
      allowLocalhost: query.allowLocalhost,
    });

    const candidates: DiscoveredPersonCandidate[] = [];

    for (const record of crawlResult.extractedRecords) {
      for (const contact of record.contacts) {
        candidates.push({
          externalId: `crawlee-${contact.companyDomain}-${candidates.length + 1}`,
          fullName: contact.contactName,
          title: contact.title,
          email: contact.email,
          emailVerification: contact.emailVerification,
          confidence: Math.round((contact.confidence || 0.8) * 100),
          linkedinUrl: contact.linkedinUrl,
          companyName: contact.companyName,
          companyDomain: contact.companyDomain,
          industry: record.company.industry,
          companySize: record.company.companySize,
          location: record.company.location,
          sourceUrls: [contact.sourceUrl || record.company.website || `https://${contact.companyDomain}`],
          rawPayload: {
            ...contact.rawPayload,
            companyMetadata: record.company.rawPayload,
            signalsDetected: record.signals.map((s) => s.signalCategory),
          },
          fieldProvenance: {
            companyName: {
              fieldName: 'companyName',
              value: contact.companyName,
              sourceProvider: 'crawlee_web',
              sourceUrl: contact.sourceUrl || null,
              retrievedAt: new Date().toISOString(),
              verificationStatus: 'unverified',
            },
            email: {
              fieldName: 'email',
              value: contact.email || '',
              sourceProvider: 'crawlee_web',
              sourceUrl: contact.sourceUrl || null,
              retrievedAt: new Date().toISOString(),
              verificationStatus: contact.emailVerification,
            },
          },
          isMock: false,
        });
      }
    }

    return candidates.slice(0, limit);
  }
}

