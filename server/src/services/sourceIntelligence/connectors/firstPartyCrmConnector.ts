import type {
  ISourceConnector,
  CompanyDiscoveryQuery,
  DiscoveredCompanyResult,
  ContactDiscoveryQuery,
  DiscoveredContactResult,
} from '../types.js';
import type {
  SourceCapability,
  SourceHealthStatus,
  SourceCostModel,
  SourceRateLimits,
} from '../../../types/index.js';
import { getDb } from '../../../db/database.js';

export class FirstPartyCrmSourceConnector implements ISourceConnector {
  public readonly id = 'first_party_crm';
  public readonly name = 'First-Party CRM & Lead Intelligence';
  public readonly providerType = 'first_party_crm';
  public readonly capabilities: SourceCapability[] = ['first_party_records', 'company_discovery'];

  public isConfigured(): boolean {
    return true; // SQLite is always configured locally
  }

  public async checkHealth(): Promise<SourceHealthStatus> {
    try {
      const db = getDb();
      db.prepare('SELECT 1').get();
      return 'healthy';
    } catch {
      return 'unreachable';
    }
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
      requestsPerMinute: 600,
      dailyQuota: 50000,
    };
  }

  public async discoverCompanies(query: CompanyDiscoveryQuery): Promise<DiscoveredCompanyResult[]> {
    const db = getDb();
    let sql = 'SELECT DISTINCT company, company_domain, industry, company_size, location FROM leads WHERE 1=1';
    const params: any[] = [];

    if (query.targetIndustries && query.targetIndustries.length > 0) {
      const placeholders = query.targetIndustries.map(() => '?').join(',');
      sql += ` AND industry IN (${placeholders})`;
      params.push(...query.targetIndustries);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(query.limit || 20);

    const rows = db.prepare(sql).all(...params) as Array<{
      company: string;
      company_domain: string;
      industry: string;
      company_size: string;
      location?: string;
    }>;

    return rows.map((r) => ({
      companyName: r.company,
      companyDomain: r.company_domain,
      industry: r.industry,
      companySize: r.company_size,
      location: r.location,
      sourceId: this.id,
      sourceUrl: `internal://crm/leads/${r.company_domain}`,
      rawPayload: r,
      confidence: 1.0,
    }));
  }

  public async discoverContacts(query: ContactDiscoveryQuery): Promise<DiscoveredContactResult[]> {
    const db = getDb();
    const rows = db.prepare(
      'SELECT name, title, email, company, company_domain, linkedin, email_verification_status FROM leads WHERE company_domain = ? LIMIT ?'
    ).all(query.companyDomain, query.limit || 10) as Array<{
      name: string;
      title: string;
      email: string;
      company: string;
      company_domain: string;
      linkedin?: string;
      email_verification_status?: string;
    }>;

    return rows.map((r) => ({
      contactName: r.name,
      title: r.title,
      email: r.email,
      companyName: r.company,
      companyDomain: r.company_domain,
      emailVerification: (r.email_verification_status as any) || 'verified',
      confidence: 1.0,
      linkedinUrl: r.linkedin,
      sourceId: this.id,
      sourceUrl: `internal://crm/contacts/${r.email}`,
      rawPayload: r,
    }));
  }
}

