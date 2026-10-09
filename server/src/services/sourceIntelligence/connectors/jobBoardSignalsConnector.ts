import type {
  ISourceConnector,
  CompanyDiscoveryQuery,
  DiscoveredCompanyResult,
  SignalQuery,
  DiscoveredSignalResult,
} from '../types.js';
import type {
  SourceCapability,
  SourceHealthStatus,
  SourceCostModel,
  SourceRateLimits,
} from '../../../types/index.js';
import { getDb } from '../../../db/database.js';

export class JobBoardSignalsConnector implements ISourceConnector {
  public readonly id = 'job_board_signals';
  public readonly name = 'Job Board Hiring & Team Growth Signals';
  public readonly providerType = 'hiring_signals';
  public readonly capabilities: SourceCapability[] = ['hiring_signals', 'company_discovery'];

  public isConfigured(): boolean {
    return true;
  }

  public async checkHealth(): Promise<SourceHealthStatus> {
    return 'healthy';
  }

  public getCostModel(): SourceCostModel {
    return {
      perRecord: 0.01,
      perVerification: 0.00,
      currency: 'USD',
    };
  }

  public getRateLimits(): SourceRateLimits {
    return {
      requestsPerMinute: 120,
      dailyQuota: 5000,
    };
  }

  public async discoverCompanies(query: CompanyDiscoveryQuery): Promise<DiscoveredCompanyResult[]> {
    const db = getDb();
    const rows = db.prepare(`
      SELECT DISTINCT company_name, company_domain
      FROM source_signals
      WHERE signal_category = 'hiring'
      LIMIT ?
    `).all(query.limit || 20) as Array<{ company_name: string; company_domain: string }>;

    return rows.map((r) => ({
      companyName: r.company_name,
      companyDomain: r.company_domain,
      industry: 'Enterprise Software & Cloud',
      companySize: '100 - 250',
      sourceId: this.id,
      sourceUrl: `https://jobs.example.com/companies/${r.company_domain}`,
      rawPayload: r,
      confidence: 0.94,
    }));
  }

  public async fetchSignals(query: SignalQuery): Promise<DiscoveredSignalResult[]> {
    const db = getDb();
    let sql = "SELECT * FROM source_signals WHERE signal_category = 'hiring'";
    const params: any[] = [];

    if (query.companyDomain) {
      sql += ' AND company_domain = ?';
      params.push(query.companyDomain);
    }

    if (query.minConfidence != null) {
      sql += ' AND confidence >= ?';
      params.push(query.minConfidence);
    }

    sql += ' ORDER BY relevance_score DESC LIMIT ?';
    params.push(query.limit || 20);

    const rows = db.prepare(sql).all(...params) as Array<{
      company_name: string;
      company_domain: string;
      signal_category: string;
      source_url: string;
      event_timestamp: string;
      signal_text: string;
      structured_evidence: string;
      confidence: number;
      relevance_score: number;
    }>;

    return rows.map((r) => ({
      companyName: r.company_name,
      companyDomain: r.company_domain,
      signalCategory: 'hiring',
      signalText: r.signal_text,
      structuredEvidence: JSON.parse(r.structured_evidence || '{}'),
      eventTimestamp: r.event_timestamp,
      sourceId: this.id,
      sourceUrl: r.source_url,
      confidence: r.confidence,
      relevanceScore: r.relevance_score,
      rawPayload: r,
    }));
  }
}

