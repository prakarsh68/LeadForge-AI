import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import { createTestContext, type TestContext } from './testHelper.js';
import { CrawleeSecurityService } from '../services/discovery/crawleeSecurityService.js';
import { CrawleeExtractionService } from '../services/discovery/crawleeExtractionService.js';
import { CrawlProfileService } from '../services/discovery/crawlProfileService.js';
import { CrawleeCrawlRunnerService } from '../services/discovery/crawleeCrawlRunnerService.js';

describe('Crawlee Web Sourcing Engine & Security Safeguards', () => {
  let ctx: TestContext;

  before(async () => {
    ctx = await createTestContext();
  });

  after(async () => {
    await ctx.cleanup();
  });

  // ==============================================================
  // 1. SSRF & URL SAFETY SAFEGUARDS
  // ==============================================================
  describe('SSRF & Boundary Protections', () => {
    test('blocks internal/loopback and cloud metadata IP addresses', () => {
      const blockedUrls = [
        'http://127.0.0.1/admin',
        'http://localhost:8080/internal',
        'http://169.254.169.254/latest/meta-data',
        'http://10.0.0.1/secrets',
        'http://192.168.1.1/router',
        'http://172.16.0.1/intranet',
        'ftp://example.com/file',
        'file:///etc/passwd',
        'javascript:alert(1)',
      ];

      for (const url of blockedUrls) {
        const result = CrawleeSecurityService.validateUrl(url);
        assert.equal(
          result.isValid,
          false,
          `URL ${url} should have been blocked for SSRF/protocol violations`
        );
        assert.ok(result.error, `URL ${url} must provide a security error description`);
      }
    });

    test('permits valid public HTTP/HTTPS URLs', () => {
      const permittedUrls = [
        'https://stripe.com',
        'https://ramp.com/about',
        'http://datadoghq.com',
        'https://www.snowflake.com/en/',
      ];

      for (const url of permittedUrls) {
        const result = CrawleeSecurityService.validateUrl(url);
        assert.equal(
          result.isValid,
          true,
          `Public URL ${url} should be approved for crawling`
        );
      }
    });

    test('enforces domain boundary scoping', () => {
      const allowedDomains = ['example.com'];

      assert.equal(
        CrawleeSecurityService.validateUrl('https://example.com/pricing', allowedDomains).isValid,
        true
      );
      assert.equal(
        CrawleeSecurityService.validateUrl('https://sub.example.com/blog', allowedDomains).isValid,
        true
      );
      assert.equal(
        CrawleeSecurityService.validateUrl('https://attacker.com/steal', allowedDomains).isValid,
        false
      );
    });
  });

  // ==============================================================
  // 2. HTML EXTRACTION & EVIDENCE HARVESTING
  // ==============================================================
  describe('Structured Extraction & Business Signals', () => {
    test('extracts company firmographics, contacts, and intent signals from mock HTML', () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Acme Cloud Solutions - Enterprise Observability</title>
          <meta name="description" content="Acme Cloud delivers resilient infrastructure monitoring for modern engineering teams.">
          <meta property="og:site_name" content="Acme Cloud">
          <link rel="canonical" href="https://acmecloud.io">
          <script type="application/ld+json">
          {
            "@type": "Organization",
            "name": "Acme Cloud Solutions Inc",
            "address": {
              "addressLocality": "San Francisco",
              "addressRegion": "CA",
              "addressCountry": "USA"
            }
          }
          </script>
        </head>
        <body>
          <nav>
            <a href="https://linkedin.com/company/acmecloud">LinkedIn</a>
            <a href="/careers">We're Hiring! View Open Positions</a>
          </nav>
          <main>
            <h1>Observability Powered by Snowflake and AWS</h1>
            <p>Our stack integrates seamlessly with PostgreSQL, Stripe, and Kubernetes.</p>
            <p>For corporate partnerships, contact our VP: <a href="mailto:sarah.connor@acmecloud.io">sarah.connor@acmecloud.io</a></p>
            <p>General inquiries: <a href="mailto:press@acmecloud.io">press@acmecloud.io</a></p>
          </main>
        </body>
        </html>
      `;

      const $ = cheerio.load(mockHtml);
      const extracted = CrawleeExtractionService.extractFromHtml($, 'https://acmecloud.io');

      // Company extraction
      assert.equal(extracted.company.companyName, 'Acme Cloud Solutions Inc');
      assert.equal(extracted.company.companyDomain, 'acmecloud.io');
      assert.ok(extracted.company.location?.includes('San Francisco'));
      assert.ok(extracted.company.rawPayload.metaDescription?.includes('resilient infrastructure'));

      // Contacts extraction
      assert.ok(extracted.contacts.length >= 2, 'Should extract both corporate and role emails');
      const sarah = extracted.contacts.find((c) => c.email === 'sarah.connor@acmecloud.io');
      assert.ok(sarah, 'Must find named contact Sarah Connor');
      assert.equal(sarah.contactName, 'Sarah Connor');
      assert.equal(sarah.companyDomain, 'acmecloud.io');

      const press = extracted.contacts.find((c) => c.email === 'press@acmecloud.io');
      assert.ok(press, 'Must find role-based contact');
      assert.equal(press.rawPayload?.isRoleBased, true);

      // Signals extraction
      const hiringSignal = extracted.signals.find((s) => s.signalCategory === 'hiring');
      assert.ok(hiringSignal, 'Must detect hiring signal from /careers link and text');

      const techSignal = extracted.signals.find((s) => s.signalCategory === 'technology');
      assert.ok(techSignal, 'Must detect tech stack adoption');
      assert.ok(techSignal.structuredEvidence.detectedTechnologies.includes('Snowflake'));
      assert.ok(techSignal.structuredEvidence.detectedTechnologies.includes('Kubernetes'));
    });
  });

  // ==============================================================
  // 3. CRAWL PROFILE CRUD OPERATIONS
  // ==============================================================
  describe('Crawl Source Profiles CRUD', () => {
    test('creates, retrieves, and lists crawl source profiles in database', () => {
      const profile = CrawlProfileService.saveProfile({
        name: 'Enterprise FinTech Seed Profile',
        description: 'Bounded seed URLs for financial tech platforms',
        startUrls: ['https://plaid.com', 'https://brex.com'],
        allowedDomains: ['plaid.com', 'brex.com'],
        maxPages: 25,
        crawlDepth: 2,
        concurrency: 2,
        delayMs: 600,
      });

      assert.ok(profile.id);
      assert.equal(profile.name, 'Enterprise FinTech Seed Profile');
      assert.equal(profile.maxPages, 25);
      assert.equal(profile.concurrency, 2);

      const retrieved = CrawlProfileService.getProfile(profile.id);
      assert.ok(retrieved);
      assert.equal(retrieved.name, profile.name);

      const all = CrawlProfileService.getAllProfiles();
      assert.ok(all.some((p: any) => p.id === profile.id));
    });
  });

  // ==============================================================
  // 4. DRY RUN EXECUTION PREVIEW
  // ==============================================================
  describe('Dry-Run Execution Plan', () => {
    test('generates explainable dry-run simulation without database mutations', () => {
      const dryRun = CrawleeCrawlRunnerService.runDryRun({
        domain: 'databricks.com',
        maxPages: 10,
        crawlDepth: 2,
      });

      assert.equal(dryRun.isDryRun, true);
      assert.equal(dryRun.provider, 'crawlee_web');
      assert.equal(dryRun.targetDomain, 'databricks.com');
      assert.equal(dryRun.securityCheck.passed, true);
      assert.ok(dryRun.filteringFunnelPreview.length >= 4);
      assert.equal(dryRun.projectedPlan.costIncurred, 0);
    });
  });

  // ==============================================================
  // 5. REST API DISCOVERY ENDPOINTS
  // ==============================================================
  describe('Discovery REST API Integration', () => {
    test('GET /api/discovery/providers includes crawlee_web with live web crawl capabilities', async () => {
      const res = await ctx.request('/api/discovery/providers');
      assert.equal(res.status, 200);

      const crawleeProvider = res.body.data.find((p: any) => p.id === 'crawlee_web');
      assert.ok(crawleeProvider, 'crawlee_web provider must be listed');
      assert.equal(crawleeProvider.mode, 'real');
      assert.equal(crawleeProvider.isConfigured, true);
      assert.ok(crawleeProvider.capabilities.includes('domain_search'));
      assert.ok(crawleeProvider.capabilities.includes('web_crawling'));
    });

    test('GET /api/discovery/crawlee/profiles returns seeded default profiles', async () => {
      const res = await ctx.request('/api/discovery/crawlee/profiles');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length >= 1, 'Should contain at least default tech hub profile');
    });

    test('POST /api/discovery/crawlee/dry-run returns simulation result', async () => {
      const res = await ctx.request('/api/discovery/crawlee/dry-run', {
        method: 'POST',
        body: JSON.stringify({
          domain: 'stripe.com',
          maxPages: 5,
        }),
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.isDryRun, true);
      assert.equal(res.body.data.targetDomain, 'stripe.com');
    });
  });
});

