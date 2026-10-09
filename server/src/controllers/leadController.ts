import type { Request, Response, NextFunction } from 'express';
import { leadService } from '../services/leadService.js';

export const leadController = {
  getAll(req: Request, res: Response, next: NextFunction): void {
    try {
      const { search, status, industry, tier, sortBy, sortOrder, limit, offset } = req.query;

      const result = leadService.getAll({
        search: typeof search === 'string' ? search : undefined,
        status: typeof status === 'string' ? status : undefined,
        industry: typeof industry === 'string' ? industry : undefined,
        tier: typeof tier === 'string' ? tier : undefined,
        sortBy: typeof sortBy === 'string' ? sortBy : undefined,
        sortOrder: sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : undefined,
        limit: limit !== undefined ? Number(limit) : undefined,
        offset: offset !== undefined ? Number(offset) : undefined,
      });

      res.status(200).json({
        success: true,
        data: result.leads,
        meta: {
          total: result.total,
          count: result.leads.length,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  getById(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id } = req.params;
      const lead = leadService.getById(id);
      if (!lead) {
        res.status(404).json({
          success: false,
          error: `Lead not found with id: ${id}`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: lead,
      });
    } catch (error) {
      next(error);
    }
  },

  create(req: Request, res: Response, _next: NextFunction): void {
    try {
      const created = leadService.create(req.body);
      res.status(201).json({
        success: true,
        data: created,
        message: 'Lead created successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Invalid lead creation data',
      });
    }
  },

  update(req: Request, res: Response, _next: NextFunction): void {
    try {
      const { id } = req.params;
      const updated = leadService.update(id, req.body);
      res.status(200).json({
        success: true,
        data: updated,
        message: 'Lead updated successfully',
      });
    } catch (error: any) {
      const isNotFound = error.message && error.message.includes('not found');
      res.status(isNotFound ? 404 : 400).json({
        success: false,
        error: error.message || 'Failed to update lead',
      });
    }
  },

  delete(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id } = req.params;
      const deleted = leadService.delete(id);
      if (!deleted) {
        res.status(404).json({
          success: false,
          error: `Lead not found with id: ${id}`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Lead deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  qualify(req: Request, res: Response, _next: NextFunction): void {
    try {
      const { id } = req.params;
      const result = leadService.qualify(id);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Lead qualified successfully',
      });
    } catch (error: any) {
      const isNotFound = error.message && error.message.includes('not found');
      res.status(isNotFound ? 404 : 400).json({
        success: false,
        error: error.message || 'Failed to qualify lead',
      });
    }
  },

  getQualification(req: Request, res: Response, _next: NextFunction): void {
    try {
      const { id } = req.params;
      const result = leadService.getQualification(id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      const isNotFound = error.message && error.message.includes('not found');
      res.status(isNotFound ? 404 : 400).json({
        success: false,
        error: error.message || 'Failed to retrieve lead qualification',
      });
    }
  },
};

