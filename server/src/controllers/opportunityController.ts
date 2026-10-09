import type { Request, Response, NextFunction } from 'express';
import { opportunityService } from '../services/opportunityService.js';

export const opportunityController = {
  getAll(req: Request, res: Response, next: NextFunction): void {
    try {
      const { stage } = req.query;
      const opportunities = opportunityService.getAll({
        stage: typeof stage === 'string' ? stage : undefined,
      });

      res.status(200).json({
        success: true,
        data: opportunities,
        meta: {
          total: opportunities.length,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  getSummary(_req: Request, res: Response, next: NextFunction): void {
    try {
      const summary = opportunityService.getSummary();
      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  },

  getById(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id } = req.params;
      const opp = opportunityService.getById(id);
      if (!opp) {
        res.status(404).json({
          success: false,
          error: `Opportunity not found with id: ${id}`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: opp,
      });
    } catch (error) {
      next(error);
    }
  },

  create(req: Request, res: Response, next: NextFunction): void {
    try {
      const created = opportunityService.create(req.body);
      res.status(201).json({
        success: true,
        data: created,
        message: 'Opportunity created successfully',
      });
    } catch (error: any) {
      const isConflict = error.message && error.message.includes('already exists');
      res.status(isConflict ? 409 : 400).json({
        success: false,
        error: error.message || 'Invalid opportunity data',
      });
    }
  },

  update(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id } = req.params;
      const updated = opportunityService.update(id, req.body);
      res.status(200).json({
        success: true,
        data: updated,
        message: 'Opportunity updated successfully',
      });
    } catch (error: any) {
      const isNotFound = error.message && error.message.includes('not found');
      res.status(isNotFound ? 404 : 400).json({
        success: false,
        error: error.message || 'Failed to update opportunity',
      });
    }
  },

  delete(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id } = req.params;
      const deleted = opportunityService.delete(id);
      if (!deleted) {
        res.status(404).json({
          success: false,
          error: `Opportunity not found with id: ${id}`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Opportunity deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  },
};

