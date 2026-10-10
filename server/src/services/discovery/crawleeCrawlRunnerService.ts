import crypto from 'node:crypto';
import { CheerioCrawler, Configuration, LogLevel, log } from 'crawlee';
import { getDb } from '../../db/database.js';
import { CrawleeSecurityService } from './crawleeSecurityService.js';
import { CrawleeExtractionService, type ExtractedPageData } from './crawleeExtractionService.js';
import { CrawlProfileService, type CrawlSourceProfile } from './crawlProfileService.js';
import { icpService } from '../icpService.js';
import { leadScoringService } from '../leadScoringService.js';
import { dataQualityService } from '../dataQualityService.js';

// Suppress verbose Crawlee logs during testing and normal operations
log.setLevel(LogLevel.WARNING);

export interface CrawlJobResult {
  jobId: string;
  provider: 'crawlee_web';
  status: 'completed' | 'failed' | 'partially_completed';
  pagesAttempted: number;
  pagesFetched: number;
  pagesSkipped: number;
  companiesObserved: number;
  signalsExtracted: number;
  candidatesStaged: number;
  durationMs: number;
  errorMessage?: string;
  extractedRecords: ExtractedPageData[];
}

export interface CrawleeDryRunResult {
  isDryRun: true;
  provider: 'crawlee_web';
  targetDomain: string;
  profileId?: string;
  startUrls: string[];
  allowedDomains: string[];
  maxPages: number;
  crawlDepth: number;
  securityCheck: {
    passed: boolean;
    issues: string[];
  };
  projectedPlan: {
    estimatedPages: number;
    estimatedCompanies: number;
    estimatedSignals: number;
    estimatedCandidates: number;
    costIncurred: 0;
  };
  filteringFunnelPreview: Array<{ stage: string; survivingCount: number; dropReason?: string }>;
  notes: string;
}

export interface ExecuteCrawlOptions {
  jobId?: string;
  profileId?: string;
  customDomain?: string;
  maxPages?: number;
  crawlDepth?: number;
  targetIcpId?: string;
  stageCandidates?: boolean;
  allowLocalhost?: boolean;
}

export class CrawleeCrawlRunnerService {
  /**
   * Executes a live Crawlee crawl job against permitted starting URLs.
   */
  public static async executeCrawl(options: ExecuteCrawlOptions): Promise<CrawlJobResult> {
    const startTime = Date.now();
    const db = getDb();
    const shouldStageCandidates = options.stageCandidates !== false;

    // 1. Resolve Profile and Starting Targets
    let profile: CrawlSourceProfile | null = null;
    if (options.profileId) {
      profile = CrawlProfileService.getProfile(options.profileId);
    }

    let startUrls: string[] = [];
    let allowedDomains: string[] = [];
    const maxPages = options.maxPages || profile?.maxPages || 20; // default 20 pages
    const crawlDepth = options.crawlDepth || profile?.crawlDepth || 2;
    const delayMs = profile?.delayMs || 1000;
    const concurrency = profile?.concurrency || 2;

    if (options.customDomain) {
      const cleanDomain = options.customDomain.trim().toLowerCase().replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i, '').replace(/^www\./, '');
      const initialUrl = options.customDomain.startsWith('http://') || options.customDomain.startsWith('https://')
        ? options.customDomain
        : `https://${cleanDomain}`;
      const securityCheck = CrawleeSecurityService.validateUrl(initialUrl, undefined, {
        allowLocalhost: options.allowLocalhost,
      });
      if (!securityCheck.isValid) {
        throw new Error(`Security validation failed for domain "${cleanDomain}": ${securityCheck.error}`);
      }
      startUrls = [securityCheck.normalizedUrl || `https://${cleanDomain}`];
      allowedDomains = profile ? Array.from(new Set([...profile.allowedDomains, cleanDomain])) : [cleanDomain];
    } else if (profile && profile.startUrls.length > 0) {
      startUrls = profile.startUrls;
      allowedDomains = profile.allowedDomains;
    } else {
      throw new Error(
        'No valid starting URL or permitted source profile configured. Please specify a domain or configure a Crawl Source Profile.'
      );
    }

    // Validate all initial URLs against SSRF rules
    for (const url of startUrls) {
      const check = CrawleeSecurityService.validateUrl(url, allowedDomains, {
        allowLocalhost: options.allowLocalhost,
      });
      if (!check.isValid) {
        throw new Error(`Blocked start URL "${url}": ${check.error}`);
      }
    }

    // 2. Create or ensure discovery_jobs record
    const jobId = options.jobId || `cjob-${crypto.randomUUID().slice(0, 8)}`;
    const existingJob = db.prepare('SELECT id FROM discovery_jobs WHERE id = ?').get(jobId) as any;

    if (!existingJob) {
      db.prepare(`
        INSERT INTO discovery_jobs (
          id, provider, mode, status, query_params, total_found, candidates_found,
          candidates_processed, candidates_ingested, candidates_skipped, candidates_failed,
          started_at, created_at, updated_at
        ) VALUES (?, 'crawlee_web', 'real', 'running', ?, 0, 0, 0, 0, 0, 0, datetime('now'), datetime('now'), datetime('now'))
      `).run(jobId, JSON.stringify({ startUrls, allowedDomains, maxPages, crawlDepth }));
    } else {
      db.prepare(`
        UPDATE discovery_jobs
        SET status = 'running', started_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).run(jobId);
    }

    const extractedResults: ExtractedPageData[] = [];
    let pagesAttempted = 0;
    let pagesFetched = 0;
    let pagesSkipped = 0;

    // 3. Configure Crawlee CheerioCrawler
    const crawlerConfig = new Configuration({
      persistStorage: false, // in-memory state; we persist to SQLite directly
    });

    const crawler = new CheerioCrawler(
      {
        maxRequestsPerCrawl: maxPages,
        maxConcurrency: concurrency,
        requestHandlerTimeoutSecs: 25,
        async requestHandler({ $, request, enqueueLinks }) {
          pagesAttempted++;
          const currentUrl = request.loadedUrl || request.url;

          // Re-validate loaded URL against security rules
          const sec = CrawleeSecurityService.validateUrl(currentUrl, allowedDomains, {
            allowLocalhost: options.allowLocalhost,
          });
          if (!sec.isValid) {
            pagesSkipped++;
            return;
          }

          pagesFetched++;

          // Extract structured data
          const pageData = CrawleeExtractionService.extractFromHtml($, currentUrl, 'crawlee_web');
          extractedResults.push(pageData);

          // Discovered link traversal within allowed crawl depth
          const currentDepth = request.userData?.depth || 0;
          if (currentDepth < crawlDepth) {
            await enqueueLinks({
              strategy: 'same-domain',
              transformRequestFunction(req) {
                const check = CrawleeSecurityService.validateUrl(req.url, allowedDomains, {
                  allowLocalhost: options.allowLocalhost,
                });
                if (!check.isValid) return false;
                req.userData = { depth: currentDepth + 1 };
                return req;
              },
            });
          }

          if (delayMs > 0) {
            await new Promise((r) => setTimeout(r, Math.min(delayMs, 200)));
          }
        },
        async failedRequestHandler({ request }, error) {
          pagesAttempted++;
          pagesSkipped++;
          // Non-blocking error handling
          console.warn(`[Crawlee] Page request failed for ${request.url}:`, error.message);
        },
      },
      crawlerConfig
    );

    // 4. Run Crawler
    try {
      await crawler.run(startUrls);
    } catch (err: any) {
      db.prepare(`
        UPDATE discovery_jobs
        SET status = 'failed', error_message = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(err.message || 'Crawl execution error', jobId);

      return {
        jobId,
        provider: 'crawlee_web',
        status: 'failed',
        pagesAttempted,
        pagesFetched,
        pagesSkipped,
        companiesObserved: 0,
        signalsExtracted: 0,
        candidatesStaged: 0,
        durationMs: Date.now() - startTime,
        errorMessage: err.message,
        extractedRecords: [],
      };
    }

    // 5. Persist Observations, Signals & Stage Candidates in SQLite
    let signalsCount = 0;
    let candidatesStagedCount = 0;
    const activeIcp = icpService.getActive();

    const insertObsStmt = db.prepare(`
      INSERT OR IGNORE INTO source_observations (
        id, source_id, entity_type, entity_key, retrieved_at,
        source_url, raw_payload, field_provenance, fingerprint,
        processing_status, company_domain, contact_email, created_at
      ) VALUES (?, 'crawlee_web', ?, ?, datetime('now'), ?, ?, ?, ?, 'normalized', ?, ?, datetime('now'))
    `);

    const insertSignalStmt = db.prepare(`
      INSERT OR IGNORE INTO source_signals (
        id, company_name, company_domain, signal_category, source_id, source_url,
        event_timestamp, observed_at, signal_text, structured_evidence,
        confidence, relevance_score, dedup_fingerprint, created_at
      ) VALUES (?, ?, ?, ?, 'crawlee_web', ?, datetime('now'), datetime('now'), ?, ?, ?, ?, ?, datetime('now'))
    `);

    const insertCandidateStmt = db.prepare(`
      INSERT INTO discovered_candidates (
        id, job_id, provider, mode, company_name, company_domain,
        contact_name, title, email, email_verification, confidence_score,
        linkedin, location, industry, company_size, source_urls,
        provenance_metadata, icp_score_preview, icp_tier_preview,
        dedup_status, status, is_mock, created_at
      ) VALUES (?, ?, 'crawlee_web', 'real', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'staged', 0, datetime('now'))
    `);

    const persistTx = db.transaction(() => {
      for (const data of extractedResults) {
        // A. Persist Company Observation
        const companyObsId = `obs-c-${crypto.randomUUID().slice(0, 8)}`;
        insertObsStmt.run(
          companyObsId,
          'company',
          data.company.companyDomain,
          data.company.sourceUrl,
          JSON.stringify(data.company.rawPayload),
          JSON.stringify({
            companyName: { source: 'crawlee_web', verified: false },
            domain: { source: 'crawlee_web', verified: true },
          }),
          data.fingerprint,
          data.company.companyDomain,
          null
        );

        // B. Persist Signals
        for (const sig of data.signals) {
          const sigId = `sig-${crypto.randomUUID().slice(0, 8)}`;
          const sigFingerprint = `${sig.companyDomain}:${sig.signalCategory}:${sig.signalText.slice(0, 50)}`;
          insertSignalStmt.run(
            sigId,
            sig.companyName,
            sig.companyDomain,
            sig.signalCategory,
            sig.sourceUrl,
            sig.signalText,
            JSON.stringify(sig.structuredEvidence),
            sig.confidence,
            sig.relevanceScore,
            sigFingerprint
          );
          signalsCount++;
        }

        // C. Identity Resolution & Staging Candidates (only when shouldStageCandidates is true)
        if (shouldStageCandidates) {
          for (const contact of data.contacts) {
            const candId = `cand-${crypto.randomUUID().slice(0, 8)}`;

            // Check deduplication against existing leads and staged candidates
            let dedupStatus = 'new';
            const normEmail = contact.email ? dataQualityService.normalizeEmail(contact.email) : undefined;
            const normDomain = dataQualityService.normalizeDomain(contact.companyDomain);

            if (normEmail) {
              const existingLead = db.prepare('SELECT id FROM leads WHERE LOWER(TRIM(email)) = ?').get(normEmail);
              if (existingLead) {
                dedupStatus = 'existing_lead';
              } else {
                const existingCand = db.prepare('SELECT id FROM discovered_candidates WHERE LOWER(TRIM(email)) = ?').get(normEmail);
                if (existingCand) {
                  dedupStatus = 'duplicate_candidate';
                }
              }
            } else if (normDomain) {
              const existingDomainLead = db.prepare('SELECT id FROM leads WHERE LOWER(TRIM(company_domain)) = ?').get(normDomain);
              if (existingDomainLead) {
                dedupStatus = 'same_company_existing';
              }
            }

            // Evaluate deterministic ICP score preview
            let scorePreview = 75;
            let tierPreview = 'medium';
            if (activeIcp) {
              try {
                const evalResult = leadScoringService.evaluateLead(
                  {
                    company: contact.companyName,
                    companyDomain: contact.companyDomain,
                    title: contact.title,
                    industry: data.company.industry || '',
                    companySize: data.company.companySize || '25-250',
                    location: data.company.location || '',
                    triggers: data.signals.map((s) => s.signalText),
                  },
                  activeIcp
                );
                scorePreview = evalResult.overallScore;
                tierPreview = evalResult.tier;
              } catch {
                // fallback default score
              }
            }

            const provenance = {
              sourceProvider: 'crawlee_web',
              crawledAt: new Date().toISOString(),
              sourceUrl: contact.sourceUrl,
              fingerprint: data.fingerprint,
              isRoleBased: contact.rawPayload?.isRoleBased ?? false,
            };

            insertCandidateStmt.run(
              candId,
              jobId,
              contact.companyName,
              contact.companyDomain,
              contact.contactName,
              contact.title,
              contact.email || null,
              contact.emailVerification || 'unverified',
              Math.round((contact.confidence || 0.8) * 100),
              contact.linkedinUrl || null,
              data.company.location || null,
              data.company.industry || null,
              data.company.companySize || '25-250',
              JSON.stringify([contact.sourceUrl || data.company.website || '']),
              JSON.stringify(provenance),
              scorePreview,
              tierPreview,
              dedupStatus
            );

            candidatesStagedCount++;
          }
        }
      }

      // Update discovery_jobs metrics only if runner performed candidate staging
      if (shouldStageCandidates) {
        db.prepare(`
          UPDATE discovery_jobs
          SET status = 'completed',
              total_found = ?,
              candidates_found = ?,
              candidates_processed = ?,
              completed_at = datetime('now'),
              updated_at = datetime('now')
          WHERE id = ?
        `).run(candidatesStagedCount, candidatesStagedCount, candidatesStagedCount, jobId);
      }
    });

    persistTx();

    const totalExtractedContacts = extractedResults.reduce((acc, r) => acc + r.contacts.length, 0);

    return {
      jobId,
      provider: 'crawlee_web',
      status: 'completed',
      pagesAttempted,
      pagesFetched,
      pagesSkipped,
      companiesObserved: extractedResults.length,
      signalsExtracted: signalsCount,
      candidatesStaged: shouldStageCandidates ? candidatesStagedCount : totalExtractedContacts,
      durationMs: Date.now() - startTime,
      extractedRecords: extractedResults,
    };
  }

  /**
   * Generates a dry-run execution plan and simulation preview without writing to SQLite.
   */
  public static runDryRun(options: {
    domain: string;
    profileId?: string;
    maxPages?: number;
    crawlDepth?: number;
  }): CrawleeDryRunResult {
    const cleanDomain = options.domain.trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/^www\./, '');
    const startUrl = `https://${cleanDomain}`;
    const allowedDomains = [cleanDomain];

    const securityCheck = CrawleeSecurityService.validateUrl(startUrl);
    const issues: string[] = [];
    if (!securityCheck.isValid) {
      issues.push(securityCheck.error || 'Invalid or forbidden URL.');
    }

    const maxPages = options.maxPages || 15;
    const crawlDepth = options.crawlDepth || 2;

    const projectedPages = Math.min(maxPages, 12);
    const estimatedCompanies = 1;
    const estimatedSignals = 2; // Hiring + Technology stack
    const estimatedCandidates = 3; // Leadership + public business email

    return {
      isDryRun: true,
      provider: 'crawlee_web',
      targetDomain: cleanDomain,
      profileId: options.profileId,
      startUrls: [startUrl],
      allowedDomains,
      maxPages,
      crawlDepth,
      securityCheck: {
        passed: securityCheck.isValid,
        issues,
      },
      projectedPlan: {
        estimatedPages: projectedPages,
        estimatedCompanies,
        estimatedSignals,
        estimatedCandidates,
        costIncurred: 0,
      },
      filteringFunnelPreview: [
        { stage: '1. Seed URL & Domain Scope', survivingCount: 1 },
        { stage: '2. HTML Content Crawl & Extraction', survivingCount: projectedPages },
        { stage: '3. Business Signals Identification', survivingCount: estimatedSignals },
        { stage: '4. Public Contact Extraction', survivingCount: estimatedCandidates },
        { stage: '5. Deterministic ICP Fit Verification', survivingCount: Math.max(1, estimatedCandidates - 1) },
      ],
      notes: `[Dry-Run Simulation]: Safe execution preview for ${cleanDomain}. Zero external network requests made, zero database mutations.`,
    };
  }
}

