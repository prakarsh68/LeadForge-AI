import type {
  ISourceConnector,
  CompanyDiscoveryQuery,
  DiscoveredCompanyResult,
  ContactDiscoveryQuery,
  DiscoveredContactResult,
  SignalQuery,
  DiscoveredSignalResult,
} from '../types.js';
import type {
  SourceCapability,
  SourceHealthStatus,
  SourceCostModel,
  SourceRateLimits,
} from '../../../types/index.js';
import { CrawlProfileService } from '../../discovery/crawlProfileService.js';
import { CrawleeCrawlRunnerService } from '../../discovery/crawleeCrawlRunnerService.js';
import { getDb } from '../../../db/database.js';

export class CrawleePublicWebSourceConnector implements ISourceConnector {
  public readonly id = 'crawlee_web';
  public readonly name = 'Crawlee Public Web Intelligence';
  public readonly providerType = 'crawlee_web';
  public readonly capabilities: SourceCapability[] = [
    'company_discovery',
    'hiring_signals',
    'technology_signals',
  ];

  public isConfigured(): boolean {
    // Configured if at least one active source profile is defined, or can accept dynamic domains
    const profiles = CrawlProfileService.getAllProfiles();
    return profiles.some((p) => p.isActive) || true;
  }

  public async checkHealth(): Promise<SourceHealthStatus> {
    // Local Cheerio crawler is operational without cloud dependency
    return 'healthy';
  }

  public getCostModel(): SourceCostModel {
    return {
      perRecord: 0.00,
      perVerification: 0.00,
      perCompany: 0.00,
      currency: 'USD',
    };
  }

  public getRateLimits(): SourceRateLimits {
    return {
      requestsPerMinute: 60,
      dailyQuota: 2000,
    };
  }

  public async discoverCompanies(query: CompanyDiscoveryQuery): Promise<DiscoveredCompanyResult[]> {
    const db = getDb();
    // Return existing Crawlee observations from SQLite if matching query, or execute targeted crawl
    const keyword = query.keywords?.[0];
    let rows: any[] = [];

    if (keyword) {
      rows = db.prepare(`
        SELECT * FROM source_observations
        WHERE source_id = 'crawlee_web' AND entity_type = 'company'
          AND (company_domain LIKE ? OR raw_payload LIKE ?)
        LIMIT ?
      `).all(`%${keyword}%`, `%${keyword}%`, query.limit || 10);
    } else {
      rows = db.prepare(`
        SELECT * FROM source_observations
        WHERE source_id = 'crawlee_web' AND entity_type = 'company'
        ORDER BY observed_at DESC
        LIMIT ?
      `).all(query.limit || 10);
    }

    if (rows.length > 0) {
      return rows.map((r) => {
        const payload = JSON.parse(r.raw_payload || '{}');
        return {
          companyName: payload.companyName || r.company_domain,
          companyDomain: r.company_domain,
          industry: payload.industry,
          companySize: payload.companySize,
          location: payload.location,
          website: payload.canonicalUrl || r.source_url,
          sourceId: this.id,
          sourceUrl: r.source_url,
          rawPayload: payload,
          confidence: 0.85,
        };
      });
    }

    // If query has a specific keyword domain (e.g., example.com), run an on-demand crawl
    if (keyword && keyword.includes('.')) {
      const crawlRes = await CrawleeCrawlRunnerService.executeCrawl({
        customDomain: keyword,
        maxPages: 5,
        crawlDepth: 1,
      });

      return crawlRes.extractedRecords.map((rec) => rec.company);
    }

    return [];
  }

  public async discoverContacts(query: ContactDiscoveryQuery): Promise<DiscoveredContactResult[]> {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM discovered_candidates
      WHERE provider = 'crawlee_web' AND company_domain = ?
      LIMIT ?
    `).all(query.companyDomain, query.limit || 10) as any[];

    if (rows.length > 0) {
      return rows.map((r) => ({
        contactName: r.contact_name,
        title: r.title,
        email: r.email || undefined,
        companyName: r.company_name,
        companyDomain: r.company_domain,
        emailVerification: r.email_verification,
        confidence: (r.confidence_score || 80) / 100,
        linkedinUrl: r.linkedin || undefined,
        sourceId: this.id,
        sourceUrl: JSON.parse(r.source_urls || '[]')[0],
        rawPayload: JSON.parse(r.provenance_metadata || '{}'),
      }));
    }

    // If none found in database, execute targeted crawl for domain
    if (query.companyDomain) {
      const crawlRes = await CrawleeCrawlRunnerService.executeCrawl({
        customDomain: query.companyDomain,
        maxPages: 5,
        crawlDepth: 2,
      });

      const allContacts = crawlRes.extractedRecords.flatMap((r) => r.contacts);
      return allContacts.slice(0, query.limit || 10);
    }

    return [];
  }

  public async fetchSignals(query: SignalQuery): Promise<DiscoveredSignalResult[]> {
    const db = getDb();
    let stmt = 'SELECT * FROM source_signals WHERE source_id = \'crawlee_web\'';
    const params: any[] = [];

    if (query.companyDomain) {
      stmt += ' AND company_domain = ?';
      params.push(query.companyDomain);
    }

    if (query.signalCategories && query.signalCategories.length > 0) {
      const placeholders = query.signalCategories.map(() => '?').join(',');
      stmt += ` AND signal_category IN (${placeholders})`;
      params.push(...query.signalCategories);
    }

    stmt += ' ORDER BY observed_at DESC LIMIT ?';
    params.push(query.limit || 20);

    const rows = db.prepare(stmt).all(...params) as any[];

    return rows.map((r) => ({
      companyName: r.company_name,
      companyDomain: r.company_domain,
      signalCategory: r.signal_category,
      signalText: r.signal_text,
      structuredEvidence: JSON.parse(r.structured_evidence || '{}'),
      eventTimestamp: r.event_timestamp,
      sourceId: this.id,
      sourceUrl: r.source_url,
      confidence: r.confidence,
      relevanceScore: r.relevance_score,
      rawPayload: { id: r.id, dedupFingerprint: r.dedup_fingerprint },
    }));
  }
}

