import type { Request, Response, NextFunction } from 'express';
import { CampaignIntentService } from '../services/sourceIntelligence/agentic/campaignIntentService.js';
import { AgenticSourcingOrchestrator } from '../services/sourceIntelligence/agentic/agenticSourcingOrchestrator.js';
import { SourcingOptimizationService } from '../services/sourceIntelligence/agentic/sourcingOptimizationService.js';
import { SourcingExperimentService } from '../services/sourceIntelligence/agentic/sourcingExperimentService.js';
import { isAgenticSourcingEnabled } from '../middleware/agenticSourcingFlag.js';
import { isSourceIntelligenceEnabled } from '../middleware/sourceIntelligenceFlag.js';
import { getDb } from '../db/database.js';

export const agenticSourcingController = {
  /**
   * GET /api/agentic-sourcing/status
   */
  async getStatus(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const enabled = isAgenticSourcingEnabled();
      const sourceIntelligenceEnabled = isSourceIntelligenceEnabled();
      const aiConfigured = Boolean(process.env.KNOWLEDGE_AI_API_KEY);

      const db = getDb();
      const activeRunsCount = (
        db.prepare("SELECT COUNT(*) as count FROM agentic_sourcing_runs WHERE status IN ('planning', 'approved', 'running')").get() as { count: number }
      ).count;

      const completedRunsCount = (
        db.prepare("SELECT COUNT(*) as count FROM agentic_sourcing_runs WHERE status = 'completed'").get() as { count: number }
      ).count;

      const optimizationWeightsCount = (
        db.prepare('SELECT COUNT(*) as count FROM sourcing_optimization_weights').get() as { count: number }
      ).count;

      const experimentsCount = (
        db.prepare('SELECT COUNT(*) as count FROM sourcing_experiments').get() as { count: number }
      ).count;

      res.json({
        enabled,
        sourceIntelligenceEnabled,
        aiConfigured,
        activeRunsCount,
        completedRunsCount,
        optimizationWeightsCount,
        experimentsCount,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/agentic-sourcing/intent/parse
   */
  async parseIntent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { rawIntent, icpProfileId } = req.body;
      if (!rawIntent || typeof rawIntent !== 'string' || !rawIntent.trim()) {
        res.status(400).json({ error: 'INVALID_INPUT', message: 'rawIntent string is required.' });
        return;
      }

      const { parsedIntent, planPreview } = await CampaignIntentService.parseIntent(rawIntent.trim(), icpProfileId);
      res.json({
        ...parsedIntent,
        planPreview,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/agentic-sourcing/runs
   */
  async createRun(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { campaignIntent, icpProfileId, maxBudgetCredits, name, targetYield } = req.body;
      if (!campaignIntent || typeof campaignIntent !== 'string' || !campaignIntent.trim()) {
        res.status(400).json({ error: 'INVALID_INPUT', message: 'campaignIntent string is required.' });
        return;
      }

      const run = await AgenticSourcingOrchestrator.createRun({
        naturalLanguageIntent: campaignIntent.trim(),
        targetIcpId: icpProfileId,
        budgetLimit: typeof maxBudgetCredits === 'number' ? maxBudgetCredits : undefined,
        name: typeof name === 'string' ? name : undefined,
        targetYield: typeof targetYield === 'number' ? targetYield : undefined,
      });

      res.status(201).json(run);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/agentic-sourcing/runs
   */
  async getAllRuns(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const runs = AgenticSourcingOrchestrator.getAllRuns();
      res.json(runs);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/agentic-sourcing/runs/:id
   */
  async getRun(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const run = AgenticSourcingOrchestrator.getRun(id);
      if (!run) {
        res.status(404).json({ error: 'NOT_FOUND', message: `Run ${id} not found.` });
        return;
      }
      res.json(run);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/agentic-sourcing/runs/:id/execute
   */
  async executeRun(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const run = await AgenticSourcingOrchestrator.executeRun(id);
      res.json(run);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/agentic-sourcing/runs/:id/cancel
   */
  async cancelRun(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const run = AgenticSourcingOrchestrator.cancelRun(id);
      if (!run) {
        res.status(404).json({ error: 'NOT_FOUND', message: `Run ${id} not found.` });
        return;
      }
      res.json(run);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/agentic-sourcing/optimization/weights
   */
  async getWeights(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const weights = SourcingOptimizationService.getWeights();
      res.json(weights);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/agentic-sourcing/optimization/recompute
   */
  async recomputeWeights(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const weights = SourcingOptimizationService.recomputeWeights();
      res.json(weights);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/agentic-sourcing/experiments/run
   */
  async runExperiment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sampleSize } = req.body;
      const sampleSizeNum = typeof sampleSize === 'number' ? sampleSize : undefined;
      const experiment = SourcingExperimentService.runExperiment(sampleSizeNum);
      res.status(201).json(experiment);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/agentic-sourcing/experiments
   */
  async getExperiments(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const experiments = SourcingExperimentService.getAllExperiments();
      res.json(experiments);
    } catch (err) {
      next(err);
    }
  },
};

