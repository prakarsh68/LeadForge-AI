import type { Request, Response, NextFunction } from 'express';
import { discoveryService } from '../services/discoveryService.js';

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
      const { provider, domain, limit, targetRoles, async: isAsync } = req.body;
      const shouldRunAsync = isAsync === true || req.query.async === 'true';

      const result = await discoveryService.startJob(
        {
          provider,
          domain,
          limit: limit !== undefined ? Number(limit) : undefined,
          targetRoles,
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
};

