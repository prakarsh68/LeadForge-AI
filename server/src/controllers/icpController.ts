import type { Request, Response, NextFunction } from 'express';
import { icpService } from '../services/icpService.js';

export const icpController = {
  getAll(_req: Request, res: Response, next: NextFunction): void {
    try {
      const profiles = icpService.getAll();
      res.status(200).json({
        success: true,
        data: profiles,
        meta: {
          total: profiles.length,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  getActive(_req: Request, res: Response, next: NextFunction): void {
    try {
      const active = icpService.getActive();
      if (!active) {
        res.status(404).json({
          success: false,
          error: 'No active ICP profile found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: active,
      });
    } catch (error) {
      next(error);
    }
  },

  getById(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id } = req.params;
      const profile = icpService.getById(id);
      if (!profile) {
        res.status(404).json({
          success: false,
          error: `ICP profile not found with id: ${id}`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  },

  create(req: Request, res: Response, _next: NextFunction): void {
    try {
      const created = icpService.create(req.body);
      res.status(201).json({
        success: true,
        data: created,
        message: 'ICP profile created successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Invalid ICP profile data',
      });
    }
  },

  update(req: Request, res: Response, _next: NextFunction): void {
    try {
      const { id } = req.params;
      const updated = icpService.update(id, req.body);
      res.status(200).json({
        success: true,
        data: updated,
        message: 'ICP profile updated successfully',
      });
    } catch (error: any) {
      const isNotFound = error.message && error.message.includes('not found');
      res.status(isNotFound ? 404 : 400).json({
        success: false,
        error: error.message || 'Failed to update ICP profile',
      });
    }
  },

  delete(req: Request, res: Response, _next: NextFunction): void {
    try {
      const { id } = req.params;
      const deleted = icpService.delete(id);
      if (!deleted) {
        res.status(404).json({
          success: false,
          error: `ICP profile not found with id: ${id}`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'ICP profile deleted successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to delete ICP profile',
      });
    }
  },
};

