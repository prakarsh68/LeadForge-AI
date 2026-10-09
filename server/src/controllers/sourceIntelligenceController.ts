import type { Request, Response, NextFunction } from 'express';
import { sourceRegistry } from '../services/sourceIntelligence/sourceConnectorRegistry.js';
import { SignalIntelligenceService } from '../services/sourceIntelligence/signalIntelligenceService.js';
import { SourcingPlannerService } from '../services/sourceIntelligence/sourcingPlannerService.js';
import { SourcingJobRunnerService } from '../services/sourceIntelligence/sourcingJobRunnerService.js';
import { SourcePerformanceService } from '../services/sourceIntelligence/sourcePerformanceService.js';
import { isSourceIntelligenceEnabled } from '../middleware/sourceIntelligenceFlag.js';
import { getDb } from '../db/database.js';

export const sourceIntelligenceController = {
  /**
   * GET /api/source-intelligence/status
   */
  async getStatus(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const enabled = isSourceIntelligenceEnabled();
      const db = getDb();
      const sourcesCount = (db.prepare('SELECT COUNT(*) as count FROM source_registry_entries').get() as { count: number }).count;
      const signalsCount = (db.prepare('SELECT COUNT(*) as count FROM source_signals').get() as { count: number }).count;
      const plansCount = (db.prepare('SELECT COUNT(*) as count FROM sourcing_plans').get() as { count: number }).count;

      res.json({
        enabled,
        sourcesCount,
        signalsCount,
        plansCount,
        message: enabled
          ? 'Adaptive Source Intelligence Engine is active.'
          : 'Adaptive Source Intelligence Engine is disabled. Set SOURCE_INTELLIGENCE_ENABLED=true to activate.',
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/source-intelligence/sources
   */
  async getSources(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entries = sourceRegistry.getAllRegistryEntries();
      res.json(entries);
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/source-intelligence/sources/:id
   */
  async toggleSource(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { isEnabled } = req.body;
      if (typeof isEnabled !== 'boolean') {
        res.status(400).json({ error: 'INVALID_INPUT', message: 'isEnabled boolean is required.' });
        return;
      }

      const updated = sourceRegistry.updateEntryStatus(id, isEnabled);
      if (!updated) {
        res.status(404).json({ error: 'NOT_FOUND', message: `Source not found: ${id}` });
        return;
      }
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/source-intelligence/sources/health
   */
  async checkHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.body;
      if (id) {
        const status = await sourceRegistry.checkHealth(id);
        res.json({ sourceId: id, status });
        return;
      }
      const results = await sourceRegistry.checkAllHealth();
      res.json(results);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/source-intelligence/signals
   */
  async getSignals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = req.query.category as any;
      const domain = req.query.domain as string | undefined;

      if (domain) {
        const signals = SignalIntelligenceService.getSignalsByDomain(domain);
        res.json(signals);
        return;
      }

      const signals = SignalIntelligenceService.getAllSignals(category);
      res.json(signals);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/source-intelligence/signals
   */
  async ingestSignal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { companyName, companyDomain, signalCategory, sourceId, signalText, structuredEvidence, confidence, relevanceScore } = req.body;
      if (!companyName || !companyDomain || !signalCategory || !sourceId || !signalText) {
        res.status(400).json({
          error: 'INVALID_INPUT',
          message: 'companyName, companyDomain, signalCategory, sourceId, and signalText are required.',
        });
        return;
      }

      const signal = SignalIntelligenceService.ingestSignal({
        companyName,
        companyDomain,
        signalCategory,
        sourceId,
        signalText,
        structuredEvidence,
        confidence,
        relevanceScore,
      });

      res.status(201).json(signal);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/source-intelligence/plans/preview
   */
  async generatePlanPreview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, targetIcpId, campaignObjective, constraints } = req.body;
      if (!name || !campaignObjective) {
        res.status(400).json({
          error: 'INVALID_INPUT',
          message: 'name and campaignObjective are required to generate a sourcing plan preview.',
        });
        return;
      }

      const preview = SourcingPlannerService.generatePlanPreview({
        name,
        targetIcpId,
        campaignObjective,
        constraints,
      });

      res.json(preview);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/source-intelligence/plans
   */
  async createPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const planDto = req.body;
      if (!planDto.id || !planDto.name || !planDto.selectedSources) {
        res.status(400).json({
          error: 'INVALID_INPUT',
          message: 'Valid plan object with id, name, and selectedSources is required.',
        });
        return;
      }

      const saved = SourcingPlannerService.savePlan(planDto);
      res.status(201).json(saved);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/source-intelligence/plans
   */
  async getPlans(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plans = SourcingPlannerService.getAllPlans();
      res.json(plans);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/source-intelligence/plans/:id
   */
  async getPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = SourcingPlannerService.getPlan(req.params.id);
      if (!plan) {
        res.status(404).json({ error: 'NOT_FOUND', message: `Plan not found: ${req.params.id}` });
        return;
      }
      res.json(plan);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/source-intelligence/plans/:id/execute
   */
  async executePlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const job = await SourcingJobRunnerService.executePlan(req.params.id);
      res.status(200).json(job);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/source-intelligence/jobs/:id
   */
  async getJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const job = SourcingJobRunnerService.getJob(req.params.id);
      if (!job) {
        res.status(404).json({ error: 'NOT_FOUND', message: `Job not found: ${req.params.id}` });
        return;
      }
      res.json(job);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/source-intelligence/analytics
   */
  async getAnalytics(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const analytics = SourcePerformanceService.getAnalytics();
      res.json(analytics);
    } catch (err) {
      next(err);
    }
  },
};

