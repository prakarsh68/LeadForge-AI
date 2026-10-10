import crypto from 'node:crypto';
import type { DiscoveredCompanyResult, DiscoveredContactResult, DiscoveredSignalResult } from '../sourceIntelligence/types.js';

export interface ExtractedPageData {
  company: DiscoveredCompanyResult;
  signals: DiscoveredSignalResult[];
  contacts: DiscoveredContactResult[];
  rawTextExcerpt: string;
  fingerprint: string;
}

export class CrawleeExtractionService {
  /**
   * Cleans and normalizes domain from a URL.
   */
  public static extractDomain(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  /**
   * Generates a deterministic SHA-256 content fingerprint.
   */
  public static generateFingerprint(data: string): string {
    return crypto.createHash('sha256').update(data.trim()).digest('hex');
  }

  /**
   * Extracts structured company metadata, public contact info, and business signals
   * from a Cheerio-parsed HTML page.
   */
  public static extractFromHtml(
    $: any,
    url: string,
    sourceId = 'crawlee_web'
  ): ExtractedPageData {
    const domain = this.extractDomain(url);

    // 1. Company Name Resolution
    let companyName = '';

    // Check JSON-LD Organization schema
    $('script[type="application/ld+json"]').each((_: any, el: any) => {
      if (companyName) return;
      try {
        const text = $(el).text();
        const json = JSON.parse(text);
        if (json['@type'] === 'Organization' && json.name) {
          companyName = String(json.name).trim();
        } else if (Array.isArray(json['@graph'])) {
          const org = json['@graph'].find((item: any) => item['@type'] === 'Organization');
          if (org?.name) companyName = String(org.name).trim();
        }
      } catch {
        // ignore parse error
      }
    });

    // Check OpenGraph site name
    if (!companyName) {
      companyName = $('meta[property="og:site_name"]').attr('content')?.trim() || '';
    }

    // Check meta application name
    if (!companyName) {
      companyName = $('meta[name="application-name"]').attr('content')?.trim() || '';
    }

    // Check Title tag and strip generic marketing suffixes
    if (!companyName) {
      const title = $('title').text().trim();
      if (title) {
        companyName = title
          .split(/[-|–—:•]/)[0]
          .replace(/^(home|welcome to|official)\s+/i, '')
          .trim();
      }
    }

    // Fallback to domain name formatted
    if (!companyName && domain) {
      const base = domain.split('.')[0];
      companyName = base.charAt(0).toUpperCase() + base.slice(1);
    }

    // 2. Business Description
    const metaDescription =
      $('meta[name="description"]').attr('content')?.trim() ||
      $('meta[property="og:description"]').attr('content')?.trim() ||
      $('p').first().text().trim().slice(0, 300) ||
      '';

    // 3. Location from meta or Schema.org
    let location: string | undefined;
    $('script[type="application/ld+json"]').each((_: any, el: any) => {
      if (location) return;
      try {
        const json = JSON.parse($(el).text());
        const address = json.address || json['@graph']?.find((item: any) => item.address)?.address;
        if (address) {
          if (typeof address === 'string') {
            location = address;
          } else if (typeof address === 'object') {
            location = [address.addressLocality, address.addressRegion, address.addressCountry]
              .filter(Boolean)
              .join(', ');
          }
        }
      } catch {
        // ignore
      }
    });

    // 4. Industry inference from keywords / meta
    const keywords = $('meta[name="keywords"]').attr('content') || '';
    let industry = 'Technology & Software';
    if (/fintech|payments|banking|financial/i.test(keywords + ' ' + metaDescription)) {
      industry = 'Fintech & Financial Services';
    } else if (/healthcare|biotech|medical|health/i.test(keywords + ' ' + metaDescription)) {
      industry = 'HealthTech & Life Sciences';
    } else if (/ecommerce|retail|shop/i.test(keywords + ' ' + metaDescription)) {
      industry = 'E-Commerce & Retail';
    } else if (/cybersecurity|security|compliance/i.test(keywords + ' ' + metaDescription)) {
      industry = 'Cybersecurity & Compliance';
    } else if (/robotics|logistics|supply chain/i.test(keywords + ' ' + metaDescription)) {
      industry = 'Robotics & Logistics';
    }

    // 5. Public Social & Canonical Links
    const canonicalUrl = $('link[rel="canonical"]').attr('href') || url;
    let linkedinUrl: string | undefined;
    $('a[href*="linkedin.com/company/"]').each((_: any, el: any) => {
      if (!linkedinUrl) {
        linkedinUrl = $(el).attr('href')?.trim();
      }
    });

    // 6. Public Business Email & Phone Discovery
    const discoveredEmails = new Set<string>();
    // Check mailto links
    $('a[href^="mailto:"]').each((_: any, el: any) => {
      const mailto = $(el).attr('href')?.replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase();
      if (mailto && this.isValidEmail(mailto)) {
        discoveredEmails.add(mailto);
      }
    });

    // Check page text for email patterns
    const bodyText = $('body').text();
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const matches = bodyText.match(emailRegex) || [];
    for (const match of matches) {
      const lower = match.toLowerCase();
      if (
        this.isValidEmail(lower) &&
        !lower.endsWith('.png') &&
        !lower.endsWith('.jpg') &&
        !lower.endsWith('.svg')
      ) {
        discoveredEmails.add(lower);
      }
    }

    // 7. Structured Contacts
    const contacts: DiscoveredContactResult[] = [];
    const emailsList = Array.from(discoveredEmails);

    if (emailsList.length > 0) {
      for (const email of emailsList.slice(0, 5)) {
        const isRoleBased = /^(info|support|contact|hello|team|sales|press|jobs|careers|admin)@/i.test(email);
        const contactName = isRoleBased
          ? `${companyName} Public Contact`
          : this.inferNameFromEmail(email);
        const title = isRoleBased ? 'Corporate Communications' : 'Business Executive';

        contacts.push({
          contactName,
          title,
          email,
          companyName,
          companyDomain: domain,
          emailVerification: 'unverified',
          confidence: isRoleBased ? 0.75 : 0.85,
          linkedinUrl,
          sourceId,
          sourceUrl: url,
          rawPayload: {
            extractedFrom: url,
            isRoleBased,
            method: 'public_html_crawlee',
          },
        });
      }
    } else {
      // Create a company-level reviewable record without fabricating a fake personal contact
      contacts.push({
        contactName: `${companyName} Leadership`,
        title: 'Executive Team',
        email: undefined,
        companyName,
        companyDomain: domain,
        emailVerification: 'unverified',
        confidence: 0.65,
        linkedinUrl,
        sourceId,
        sourceUrl: url,
        rawPayload: {
          extractedFrom: url,
          method: 'company_header_crawlee',
          isCompanyRepresentative: true,
        },
      });
    }

    // 8. Business Signals (Hiring, Tech Stack, Expansion)
    const signals: DiscoveredSignalResult[] = [];

    // Check for hiring signals
    const hiringKeywords = [
      'careers',
      "we're hiring",
      'join our team',
      'open positions',
      'view open roles',
      'job openings',
    ];
    const hasCareersLink = $('a[href*="careers"], a[href*="jobs"]').length > 0;
    const mentionsHiring = hiringKeywords.some((kw) => bodyText.toLowerCase().includes(kw));

    if (hasCareersLink || mentionsHiring) {
      signals.push({
        companyName,
        companyDomain: domain,
        signalCategory: 'hiring',
        signalText: `Active hiring detected on corporate website with dedicated careers section.`,
        structuredEvidence: {
          hasCareersLink,
          sourcePage: url,
          detectedAt: new Date().toISOString(),
        },
        eventTimestamp: new Date().toISOString(),
        sourceId,
        sourceUrl: url,
        confidence: 0.90,
        relevanceScore: 85,
        rawPayload: {
          sourceUrl: url,
          type: 'hiring_intent',
        },
      });
    }

    // Check for technology stack signals
    const detectedTech: string[] = [];
    const techSignatures = [
      'Snowflake',
      'Salesforce',
      'HubSpot',
      'Stripe',
      'Datadog',
      'Kubernetes',
      'AWS',
      'React',
      'Next.js',
      'PostgreSQL',
      'Tailwind',
    ];
    for (const tech of techSignatures) {
      if (bodyText.includes(tech)) {
        detectedTech.push(tech);
      }
    }

    if (detectedTech.length > 0) {
      signals.push({
        companyName,
        companyDomain: domain,
        signalCategory: 'technology',
        signalText: `Identified stack adoption from public documentation: ${detectedTech.slice(0, 4).join(', ')}.`,
        structuredEvidence: {
          detectedTechnologies: detectedTech,
          sourcePage: url,
        },
        eventTimestamp: new Date().toISOString(),
        sourceId,
        sourceUrl: url,
        confidence: 0.88,
        relevanceScore: 80,
        rawPayload: {
          technologies: detectedTech,
        },
      });
    }

    // Fingerprint calculation
    const rawExcerpt = bodyText.slice(0, 1000).replace(/\s+/g, ' ').trim();
    const fingerprint = this.generateFingerprint(`${domain}:${companyName}:${rawExcerpt.slice(0, 200)}`);

    const company: DiscoveredCompanyResult = {
      companyName,
      companyDomain: domain,
      industry,
      companySize: '25-250',
      location,
      website: canonicalUrl,
      sourceId,
      sourceUrl: url,
      confidence: 0.85,
      rawPayload: {
        metaDescription,
        canonicalUrl,
        linkedinUrl,
        extractedAt: new Date().toISOString(),
        fingerprint,
      },
    };

    return {
      company,
      signals,
      contacts,
      rawTextExcerpt: rawExcerpt,
      fingerprint,
    };
  }

  private static isValidEmail(email: string): boolean {
    if (!email || email.length > 254) return false;
    const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    return re.test(email);
  }

  private static inferNameFromEmail(email: string): string {
    const userPart = email.split('@')[0];
    const parts = userPart.split(/[._-]/).filter(Boolean);
    if (parts.length >= 2) {
      return parts
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
        .join(' ');
    }
    return userPart.charAt(0).toUpperCase() + userPart.slice(1);
  }
}

