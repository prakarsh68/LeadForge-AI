import type {
  DiscoveryProvider,
  PeopleDiscoveryQuery,
  DiscoveredPersonCandidate,
} from './types.js';
import {
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderTimeoutError,
  ProviderApiError,
} from './types.js';
import type { DiscoveryMode, FieldProvenance, VerificationStatus } from '../../types/index.js';

export class HunterDiscoveryProvider implements DiscoveryProvider {
  public readonly id = 'hunter';
  public readonly displayName = 'Hunter.io (Domain Search API v2)';
  public readonly mode: DiscoveryMode = 'real';
  public readonly description = 'Real-time verified business email discovery, corporate domain search, and public source citations.';
  public readonly capabilities = ['domain_search', 'email_verification', 'source_citations'];

  private readonly getApiKey: () => string | undefined;
  private readonly fetchImpl: typeof fetch;

  constructor(
    apiKeyProvider: () => string | undefined = () => process.env.HUNTER_API_KEY,
    fetchImpl: typeof fetch = fetch
  ) {
    this.getApiKey = apiKeyProvider;
    this.fetchImpl = fetchImpl;
  }

  public isConfigured(): boolean {
    const key = this.getApiKey();
    return Boolean(key && key.trim().length > 0);
  }

  public async searchDomain(query: PeopleDiscoveryQuery): Promise<DiscoveredPersonCandidate[]> {
    if (!query.domain || !query.domain.trim()) {
      throw new ProviderApiError('A valid company domain is required for Hunter.io domain search.', 400);
    }

    const apiKey = this.getApiKey();
    if (!apiKey || !apiKey.trim()) {
      throw new ProviderAuthError(
        'Hunter.io API key is not configured. Set HUNTER_API_KEY in the server environment or use Demo Mode.'
      );
    }

    const domainNorm = query.domain
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0];

    const limit = Math.max(1, Math.min(query.limit || 10, 50));
    const url = new URL('https://api.hunter.io/v2/domain-search');
    url.searchParams.set('domain', domainNorm);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('type', 'personal');

    if (query.targetRoles && query.targetRoles.length > 0) {
      url.searchParams.set('department', 'sales,management,executive,marketing');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        method: 'GET',
        headers: {
          'X-API-KEY': apiKey.trim(),
          'Accept': 'application/json',
          'User-Agent': 'LeadForge-AI-Discovery/1.0',
        },
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new ProviderTimeoutError('Hunter.io API request timed out after 8000ms.');
      }
      throw new ProviderApiError(`Network failure while contacting Hunter.io: ${err.message}`);
    } finally {
      clearTimeout(timeoutId);
    }

    let payload: any;
    try {
      payload = await response.json();
    } catch {
      throw new ProviderApiError(`Hunter.io returned non-JSON response with HTTP status ${response.status}`, response.status);
    }

    // Handle HTTP error statuses
    if (!response.ok) {
      const errorMsg =
        payload?.errors?.[0]?.details ||
        payload?.errors?.[0]?.id ||
        `Hunter.io request failed with HTTP ${response.status}`;

      if (response.status === 401) {
        throw new ProviderAuthError('Hunter.io authentication failed. Please verify your HUNTER_API_KEY.');
      }
      if (response.status === 403) {
        throw new ProviderRateLimitError('Hunter.io rate limit exceeded. Too many requests per second.');
      }
      if (response.status === 429) {
        throw new ProviderRateLimitError('Hunter.io plan usage limit exceeded. Monthly credit quota reached.');
      }
      throw new ProviderApiError(errorMsg, response.status, payload);
    }

    const data = payload?.data;
    if (!data || !Array.isArray(data.emails)) {
      return [];
    }

    const companyName = data.organization || domainNorm.split('.')[0];
    const retrievedAt = new Date().toISOString();

    return data.emails.map((e: any, idx: number): DiscoveredPersonCandidate => {
      const firstName = e.first_name || '';
      const lastName = e.last_name || '';
      const fullName = firstName && lastName ? `${firstName} ${lastName}` : firstName || e.value.split('@')[0];
      const position = e.position || 'Decision Maker';
      const email = e.value;
      const confidence = typeof e.confidence === 'number' ? e.confidence : 75;

      let emailVerification: VerificationStatus = 'unverified';
      if (e.verification?.status === 'valid') emailVerification = 'verified';
      else if (e.verification?.status === 'accept_all' || e.verification?.status === 'risky') emailVerification = 'risky';
      else if (e.verification?.status === 'invalid') emailVerification = 'undeliverable';

      const sourceUrls: string[] = Array.isArray(e.sources)
        ? e.sources.map((s: any) => s.uri).filter((uri: any): uri is string => typeof uri === 'string' && uri.length > 0)
        : [];

      const primarySourceUrl = sourceUrls[0] || `https://${domainNorm}`;

      const provenance: Record<string, FieldProvenance> = {
        name: {
          fieldName: 'name',
          value: fullName,
          sourceProvider: 'hunter',
          sourceUrl: primarySourceUrl,
          retrievedAt,
          verificationStatus: firstName ? 'verified' : 'inferred',
        },
        email: {
          fieldName: 'email',
          value: email,
          sourceProvider: 'hunter',
          sourceUrl: primarySourceUrl,
          retrievedAt,
          verificationStatus: emailVerification,
          confidence,
        },
        title: {
          fieldName: 'title',
          value: position,
          sourceProvider: 'hunter',
          sourceUrl: primarySourceUrl,
          retrievedAt,
          verificationStatus: e.position ? 'verified' : 'inferred',
        },
        company: {
          fieldName: 'company',
          value: companyName,
          sourceProvider: 'hunter',
          sourceUrl: `https://${domainNorm}`,
          retrievedAt,
          verificationStatus: 'verified',
        },
      };

      return {
        externalId: `hunter-${domainNorm}-${idx + 1}`,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        fullName,
        title: position,
        email,
        emailVerification,
        confidence,
        linkedinUrl: e.linkedin || undefined,
        companyName,
        companyDomain: domainNorm,
        industry: data.industry || undefined,
        companySize: data.headcount || undefined,
        location: [data.city, data.state, data.country].filter(Boolean).join(', ') || undefined,
        sourceUrls,
        rawPayload: {
          seniority: e.seniority,
          department: e.department,
          verificationDate: e.verification?.date,
        },
        fieldProvenance: provenance,
        isMock: false,
      };
    });
  }
}

