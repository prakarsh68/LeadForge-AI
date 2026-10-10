import type { Request, Response, NextFunction } from 'express';
import { discoveryService } from '../services/discoveryService.js';
import { CrawlProfileService } from '../services/discovery/crawlProfileService.js';
import { CrawleeCrawlRunnerService } from '../services/discovery/crawleeCrawlRunnerService.js';

export const discoveryController = {
  getProviders(_req: Request, res: Response, next: NextFunction): void {
    try {
      const providers = discoveryService.listProviders();
      res.status(200).json({
        success: true,
        data: providers,
      });
    } catch (error) {
      next(error);
    }
  },

  async startJob(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { provider, domain, limit, targetRoles, profileId, async: isAsync } = req.body;
      const shouldRunAsync = isAsync === true || req.query.async === 'true';

      const result = await discoveryService.startJob(
        {
          provider,
          domain,
          limit: limit !== undefined ? Number(limit) : undefined,
          targetRoles,
          profileId,
        },
        { async: shouldRunAsync }
      );

      const msg =
        result.job.status === 'queued'
          ? 'Discovery job queued successfully for background execution.'
          : `Discovery job completed. Found ${result.candidates.length} candidates.`;

      res.status(201).json({
        success: true,
        data: result,
        message: msg,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Discovery job failed to start.',
      });
    }
  },

  cancelJob(req: Request, res: Response, _next: NextFunction): void {
    try {
      const { id } = req.params;
      const result = discoveryService.cancelJob(id);
      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.message,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.job,
        message: result.message,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to cancel discovery job.',
      });
    }
  },

  retryJob(req: Request, res: Response, _next: NextFunction): void {
    try {
      const { id } = req.params;
      const result = discoveryService.retryJob(id);
      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.message,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.job,
        message: result.message,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to retry discovery job.',
      });
    }
  },

  getJob(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id } = req.params;
      const job = discoveryService.getJob(id);
      if (!job) {
        res.status(404).json({
          success: false,
          error: `Discovery job not found with id: ${id}`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: job,
      });
    } catch (error) {
      next(error);
    }
  },

  getCandidates(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id } = req.params;
      const { status } = req.query;
      const job = discoveryService.getJob(id);
      if (!job) {
        res.status(404).json({
          success: false,
          error: `Discovery job not found with id: ${id}`,
        });
        return;
      }

      const candidates = discoveryService.getCandidates(id, {
        status: typeof status === 'string' ? status : undefined,
      });

      res.status(200).json({
        success: true,
        data: candidates,
        meta: {
          jobId: id,
          count: candidates.length,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  ingestCandidate(req: Request, res: Response, _next: NextFunction): void {
    try {
      const { id } = req.params;
      const result = discoveryService.ingestCandidate(id);
      res.status(200).json({
        success: true,
        data: result,
        message: `Candidate "${result.lead.name}" successfully ingested into CRM.`,
      });
    } catch (error: any) {
      const isNotFound = error.message && error.message.includes('not found');
      res.status(isNotFound ? 404 : 400).json({
        success: false,
        error: error.message || 'Failed to ingest candidate.',
      });
    }
  },

  getAllJobs(req: Request, res: Response, next: NextFunction): void {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const jobs = discoveryService.getAllJobs(limit);
      res.status(200).json({
        success: true,
        data: jobs,
        meta: { count: jobs.length },
      });
    } catch (error) {
      next(error);
    }
  },

  getAllCandidates(req: Request, res: Response, next: NextFunction): void {
    try {
      const { status, limit } = req.query;
      const candidates = discoveryService.getAllCandidates({
        status: typeof status === 'string' ? status : undefined,
        limit: limit ? Number(limit) : 50,
      });
      res.status(200).json({
        success: true,
        data: candidates,
        meta: { count: candidates.length },
      });
    } catch (error) {
      next(error);
    }
  },

  ingestBatch(req: Request, res: Response, _next: NextFunction): void {
    try {
      const { candidateIds } = req.body;
      if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'candidateIds must be a non-empty array of candidate IDs.',
        });
        return;
      }

      const results = discoveryService.ingestBatch(candidateIds);
      res.status(200).json({
        success: true,
        data: results,
        message: `Batch ingestion complete: ${results.counts.ingested} created, ${results.counts.skipped} skipped, ${results.counts.failed} failed.`,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Batch ingestion failed.',
      });
    }
  },

  getCapabilities(_req: Request, res: Response, next: NextFunction): void {
    try {
      const capabilities = discoveryService.getConnectorCapabilities();
      res.status(200).json({
        success: true,
        data: capabilities,
        meta: { count: capabilities.length },
      });
    } catch (error) {
      next(error);
    }
  },

  runDryRun(req: Request, res: Response, _next: NextFunction): void {
    try {
      const { domain, limit, targetRoles } = req.body;
      const result = discoveryService.runDryRun({
        domain,
        limit: limit !== undefined ? Number(limit) : undefined,
        targetRoles,
      });

      res.status(200).json({
        success: true,
        data: result,
        message: `Dry-run simulation complete for ${result.domain}. Projected yield: ${result.projectedYield} candidates.`,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Dry-run simulation failed.',
      });
    }
  },

  cleanupDemoData(_req: Request, res: Response, _next: NextFunction): void {
    try {
      const counts = discoveryService.cleanupDemoData();
      res.status(200).json({
        success: true,
        data: counts,
        message: `Purged ${counts.cleanedCandidates} demo candidates and ${counts.cleanedLeads} demo leads. Production data preserved.`,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to cleanup demo data.',
      });
    }
  },

  // Crawlee Source Profile and Crawling Handlers
  getCrawlProfiles(_req: Request, res: Response, next: NextFunction): void {
    try {
      const profiles = CrawlProfileService.getAllProfiles();
      res.status(200).json({
        success: true,
        data: profiles,
        meta: { count: profiles.length },
      });
    } catch (error) {
      next(error);
    }
  },

  saveCrawlProfile(req: Request, res: Response, _next: NextFunction): void {
    try {
      const profile = CrawlProfileService.saveProfile(req.body);
      res.status(200).json({
        success: true,
        data: profile,
        message: `Crawl source profile "${profile.name}" saved successfully.`,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to save crawl source profile.',
      });
    }
  },

  deleteCrawlProfile(req: Request, res: Response, _next: NextFunction): void {
    try {
      const { id } = req.params;
      const deleted = CrawlProfileService.deleteProfile(id);
      if (!deleted) {
        res.status(404).json({ success: false, error: `Profile not found: ${id}` });
        return;
      }
      res.status(200).json({ success: true, message: `Profile ${id} deleted.` });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete crawl source profile.',
      });
    }
  },

  async startCrawleeCrawl(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { domain, profileId, maxPages, crawlDepth } = req.body;
      const result = await CrawleeCrawlRunnerService.executeCrawl({
        customDomain: domain,
        profileId,
        maxPages: maxPages ? Number(maxPages) : undefined,
        crawlDepth: crawlDepth ? Number(crawlDepth) : undefined,
      });

      res.status(200).json({
        success: true,
        data: result,
        message: `Crawlee crawl finished: ${result.companiesObserved} companies, ${result.signalsExtracted} signals, ${result.candidatesStaged} candidates staged.`,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Crawlee crawl execution failed.',
      });
    }
  },

  runCrawleeDryRun(req: Request, res: Response, _next: NextFunction): void {
    try {
      const { domain, profileId, maxPages, crawlDepth } = req.body;
      if (!domain) {
        res.status(400).json({ success: false, error: 'Domain is required for dry-run simulation.' });
        return;
      }

      const result = CrawleeCrawlRunnerService.runDryRun({
        domain,
        profileId,
        maxPages: maxPages ? Number(maxPages) : undefined,
        crawlDepth: crawlDepth ? Number(crawlDepth) : undefined,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Crawlee dry-run failed.',
      });
    }
  },
};


