import type { Request, Response, NextFunction } from 'express';
import { activityService } from '../services/activityService.js';
import { ALLOWED_ACTIVITY_TYPES } from '../utils/validators.js';

export const activityController = {
  getAll(req: Request, res: Response, next: NextFunction): void {
    try {
      const { limit, type } = req.query;
      const result = activityService.getAll({
        limit: limit !== undefined ? Number(limit) : undefined,
        type: typeof type === 'string' ? type : undefined,
      });

      res.status(200).json({
        success: true,
        data: result.items,
        meta: {
          total: result.total,
          count: result.items.length,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  create(req: Request, res: Response, next: NextFunction): void {
    try {
      const { type, title, description, badge, timestamp } = req.body;

      if (!type || !ALLOWED_ACTIVITY_TYPES.includes(type)) {
        res.status(400).json({
          success: false,
          error: `Activity type must be one of: ${ALLOWED_ACTIVITY_TYPES.join(', ')}`,
        });
        return;
      }

      if (!title || typeof title !== 'string' || !title.trim()) {
        res.status(400).json({
          success: false,
          error: 'Activity title is required',
        });
        return;
      }

      if (!description || typeof description !== 'string' || !description.trim()) {
        res.status(400).json({
          success: false,
          error: 'Activity description is required',
        });
        return;
      }

      const created = activityService.create({
        type,
        title: title.trim(),
        description: description.trim(),
        badge: typeof badge === 'string' ? badge : undefined,
        timestamp: typeof timestamp === 'string' ? timestamp : undefined,
      });

      res.status(201).json({
        success: true,
        data: created,
        message: 'Activity logged successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to create activity',
      });
    }
  },
};

