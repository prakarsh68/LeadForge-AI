import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createTestContext, type TestContext } from './testHelper.js';
import { CrawleeSecurityService } from '../services/discovery/crawleeSecurityService.js';
import { CrawleeCrawlRunnerService } from '../services/discovery/crawleeCrawlRunnerService.js';
import { discoveryService } from '../services/discoveryService.js';

describe('Crawlee Live HTTP Crawling & Downstream Lead Integration Path', () => {
  let ctx: TestContext;
  let mockServer: http.Server;
  let mockServerPort: number;
  let mockServerHost: string;

  before(async () => {
    ctx = await createTestContext();

    // Start a controlled local HTTP server simulating a real public enterprise company website
    mockServer = http.createServer((req, res) => {
      const url = req.url || '/';

      if (url === '/' || url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="utf-8" />
            <title>NovaPay Technologies - Global B2B Payments Infrastructure</title>
            <meta name="description" content="NovaPay is an enterprise cloud fintech platform providing cross-border payment orchestration and billing APIs." />
            <meta property="og:site_name" content="NovaPay Technologies" />
            <link rel="canonical" href="http://${mockServerHost}/" />
            <script type="application/ld+json">
            {
              "@type": "Organization",
              "name": "NovaPay Technologies Inc",
              "address": {
                "addressLocality": "San Francisco",
                "addressRegion": "CA",
                "addressCountry": "USA"
              }
            }
            </script>
          </head>
          <body>
            <header>
              <nav>
                <a href="/careers">Careers & Open Roles</a>
                <a href="https://linkedin.com/company/novapay-technologies">LinkedIn Profile</a>
              </nav>
            </header>
            <main>
              <h1>Next-Generation B2B Payments Architecture</h1>
              <p>Built with enterprise scalability on AWS and Snowflake, integrating seamlessly with Stripe and PostgreSQL.</p>
              <section id="contacts">
                <p>For executive partnership inquiries, contact VP of Partnerships: <a href="mailto:elena.rostova@novapay.io">elena.rostova@novapay.io</a></p>
                <p>Customer Support: <a href="mailto:support@novapay.io">support@novapay.io</a></p>
              </section>
            </main>
          </body>
          </html>
        `);
      } else if (url === '/careers') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>NovaPay Careers - Join Our Engineering Team</title>
          </head>
          <body>
            <h1>We're Hiring Across Engineering, DevOps, and Product!</h1>
            <p>View open roles in San Francisco, London, and remote.</p>
          </body>
          </html>
        `);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    await new Promise<void>((resolve) => {
      mockServer.listen(0, '127.0.0.1', () => {
        const address = mockServer.address() as AddressInfo;
        mockServerPort = address.port;
        mockServerHost = `127.0.0.1:${mockServerPort}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (mockServer) {
      await new Promise<void>((resolve) => mockServer.close(() => resolve()));
    }
    await ctx.cleanup();
  });

  // ==============================================================
  // 1. SSRF & DOMAIN WILDCARD VALIDATION
  // ==============================================================
  describe('SSRF & Wildcard Domain Validation Rules', () => {
    test('blocks loopback and internal targets by default', () => {
      const loopbackResult = CrawleeSecurityService.validateUrl(`http://${mockServerHost}/`);
      assert.equal(loopbackResult.isValid, false, 'Default SSRF check must block 127.0.0.1');
      assert.ok(
        loopbackResult.error?.includes('prohibited') || loopbackResult.error?.includes('restricted'),
        'Must report SSRF violation'
      );
    });

    test('permits loopback target only when allowLocalhost test flag is explicitly set', () => {
      const allowedResult = CrawleeSecurityService.validateUrl(
        `http://${mockServerHost}/`,
        ['127.0.0.1'],
        { allowLocalhost: true }
      );
      assert.equal(allowedResult.isValid, true, 'allowLocalhost flag must permit local test harness');
      assert.equal(allowedResult.domain, '127.0.0.1');
    });

    test('normalizes raw domain inputs without scheme prefix', () => {
      const res = CrawleeSecurityService.validateUrl('stripe.com');
      assert.equal(res.isValid, true);
      assert.equal(res.normalizedUrl, 'https://stripe.com/');
    });

    test('matches wildcard domain patterns (*.ramp.com) against apex and subdomains', () => {
      const allowedWildcard = ['*.ramp.com'];

      // Apex match
      const apexRes = CrawleeSecurityService.validateUrl('https://ramp.com/about', allowedWildcard);
      assert.equal(apexRes.isValid, true, 'Apex ramp.com must match *.ramp.com');

      // Subdomain match
      const subRes = CrawleeSecurityService.validateUrl('https://careers.ramp.com/jobs', allowedWildcard);
      assert.equal(subRes.isValid, true, 'Subdomain careers.ramp.com must match *.ramp.com');

      // Unrelated domain rejection
      const unauthRes = CrawleeSecurityService.validateUrl('https://evilramp.com', allowedWildcard);
      assert.equal(unauthRes.isValid, false, 'Non-subdomain evilramp.com must be rejected');
    });
  });

  // ==============================================================
  // 2. REAL HTTP CRAWL RUNNER PERSISTENCE & OBSERVATIONS
  // ==============================================================
  describe('Real HTTP Crawl Execution & Observation Persistence', () => {
    test('fetches real HTTP responses, extracts structured observations and signals into SQLite', async () => {
      const result = await CrawleeCrawlRunnerService.executeCrawl({
        customDomain: `http://${mockServerHost}`,
        maxPages: 3,
        crawlDepth: 1,
        allowLocalhost: true,
        stageCandidates: true,
      });

      assert.equal(result.status, 'completed');
      assert.ok(result.pagesFetched >= 1, `Must fetch at least 1 page (actual: ${result.pagesFetched})`);
      assert.ok(result.companiesObserved >= 1, 'Must observe at least 1 company');
      assert.ok(result.signalsExtracted >= 2, `Must extract hiring and tech signals (actual: ${result.signalsExtracted})`);
      assert.ok(result.candidatesStaged >= 2, `Must stage at least 2 candidates (actual: ${result.candidatesStaged})`);

      // Verify persistent SQLite source_observations
      const db = ctx.db;
      const obsRows = db.prepare('SELECT * FROM source_observations WHERE source_id = ?').all('crawlee_web') as any[];
      assert.ok(obsRows.length >= 1, 'source_observations table must contain genuine crawl observations');
      const companyObs = obsRows.find((o) => o.entity_type === 'company');
      assert.ok(companyObs, 'Must have recorded company-level observation');
      assert.equal(companyObs.processing_status, 'normalized');

      // Verify persistent SQLite source_signals
      const signalRows = db.prepare('SELECT * FROM source_signals WHERE source_id = ?').all('crawlee_web') as any[];
      assert.ok(signalRows.length >= 2, 'source_signals table must contain detected signals');
      const hiringSig = signalRows.find((s) => s.signal_category === 'hiring');
      const techSig = signalRows.find((s) => s.signal_category === 'technology');
      assert.ok(hiringSig, 'Hiring signal must be persisted in source_signals');
      assert.ok(techSig, 'Technology stack signal must be persisted in source_signals');

      // Verify staged candidate with provenance
      const stagedCandidates = db
        .prepare('SELECT * FROM discovered_candidates WHERE provider = ? AND job_id = ?')
        .all('crawlee_web', result.jobId) as any[];
      assert.ok(stagedCandidates.length >= 2, 'Must stage discovered candidates');

      const elena = stagedCandidates.find((c) => c.email === 'elena.rostova@novapay.io');
      assert.ok(elena, 'Elena Rostova candidate must be staged');
      assert.equal(elena.mode, 'real');
      assert.equal(elena.is_mock, 0);
      assert.equal(elena.contact_name, 'Elena Rostova');
      assert.ok(elena.source_urls.includes(`http://${mockServerHost}/`));

      const prov = JSON.parse(elena.provenance_metadata);
      assert.equal(prov.sourceProvider, 'crawlee_web');
      assert.equal(prov.sourceUrl, `http://${mockServerHost}/`);
    });
  });

  // ==============================================================
  // 3. CANDIDATE INGESTION & DOWNSTREAM CRM INTEGRATION
  // ==============================================================
  describe('Discovered Candidate Ingestion into CRM Leads & Opportunities', () => {
    test('promotes real crawled candidate into CRM lead with Crawlee provenance and qualification score', async () => {
      const db = ctx.db;

      // Find Elena Rostova staged candidate
      const elena = db
        .prepare('SELECT * FROM discovered_candidates WHERE email = ? AND provider = ?')
        .get('elena.rostova@novapay.io', 'crawlee_web') as any;
      assert.ok(elena, 'Elena Rostova candidate must exist in SQLite');

      // Execute CRM ingestion via discoveryService
      const ingestResult = discoveryService.ingestCandidate(elena.id);
      assert.ok(ingestResult.lead, 'Lead record must be created');
      assert.equal(ingestResult.lead.email, 'elena.rostova@novapay.io');
      assert.equal(ingestResult.lead.name, 'Elena Rostova');

      // Verify lead record in leads table
      const leadRow = db.prepare('SELECT * FROM leads WHERE id = ?').get(ingestResult.lead.id) as any;
      assert.ok(leadRow, 'Lead row must exist in leads table');
      assert.equal(leadRow.source_provider, 'crawlee_web');
      assert.equal(leadRow.is_mock, 0);
      assert.ok(leadRow.score >= 0, 'Lead must have a calculated ICP score');
      assert.ok(leadRow.source_url?.includes(mockServerHost), 'Lead source_url must record crawl origin');

      // Verify opportunity creation
      const oppRow = db.prepare('SELECT * FROM opportunities WHERE lead_id = ?').get(leadRow.id) as any;
      assert.ok(oppRow, 'Opportunity must be automatically created in pipeline');
      assert.equal(oppRow.lead_id, leadRow.id);

      // Verify candidate status updated to ingested
      const updatedCand = db.prepare('SELECT * FROM discovered_candidates WHERE id = ?').get(elena.id) as any;
      assert.equal(updatedCand.status, 'ingested');
      assert.equal(updatedCand.ingested_lead_id, leadRow.id);
    });

    test('rejects candidate ingestion when contact email is missing instead of fabricating placeholder email', () => {
      const db = ctx.db;
      const noEmailCandId = 'cand-test-no-email-999';

      db.prepare(`
        INSERT OR IGNORE INTO discovery_jobs (
          id, provider, mode, status, query_params, created_at, updated_at
        ) VALUES ('job-test', 'crawlee_web', 'real', 'completed', '{}', datetime('now'), datetime('now'))
      `).run();

      db.prepare(`
        INSERT INTO discovered_candidates (
          id, job_id, provider, mode, contact_name, title, company_name, company_domain,
          email, email_verification, source_urls, provenance_metadata, dedup_status, status, is_mock, created_at
        ) VALUES (?, 'job-test', 'crawlee_web', 'real', 'Executive Leadership', 'Executive Team', 'Ghost Inc', 'ghost.io',
          NULL, 'unverified', '["https://ghost.io"]', '{}', 'new', 'staged', 0, datetime('now'))
      `).run(noEmailCandId);

      assert.throws(
        () => {
          discoveryService.ingestCandidate(noEmailCandId);
        },
        /cannot be ingested because no verified or public business email was discovered/i,
        'Must reject ingestion when candidate lacks a genuine email'
      );

      // Verify no fake lead with contact@ghost.io was created
      const fakeLead = db.prepare('SELECT id FROM leads WHERE company_domain = ?').get('ghost.io');
      assert.equal(fakeLead, undefined, 'No fake lead should exist in CRM for candidate without email');
    });
  });
});
