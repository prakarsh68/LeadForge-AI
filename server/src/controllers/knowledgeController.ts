import type { Request, Response, NextFunction } from 'express';
import { knowledgeService } from '../services/knowledgeService.js';

export const knowledgeController = {
  getAll(req: Request, res: Response, next: NextFunction): void {
    try {
      const { category, status, search } = req.query;
      const documents = knowledgeService.getAll({
        category: typeof category === 'string' ? category : undefined,
        status: typeof status === 'string' ? status : undefined,
        search: typeof search === 'string' ? search : undefined,
      });

      res.status(200).json({
        success: true,
        data: documents,
        meta: {
          total: documents.length,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  getById(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id } = req.params;
      const document = knowledgeService.getById(id);
      if (!document) {
        res.status(404).json({
          success: false,
          error: `Knowledge document not found with id: ${id}`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: document,
      });
    } catch (error) {
      next(error);
    }
  },

  create(req: Request, res: Response, next: NextFunction): void {
    try {
      const created = knowledgeService.create(req.body);
      res.status(201).json({
        success: true,
        data: created,
        message: 'Knowledge document created successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Invalid knowledge document data',
      });
    }
  },

  update(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id } = req.params;
      const updated = knowledgeService.update(id, req.body);
      res.status(200).json({
        success: true,
        data: updated,
        message: 'Knowledge document updated successfully',
      });
    } catch (error: any) {
      const isNotFound = error.message && error.message.includes('not found');
      res.status(isNotFound ? 404 : 400).json({
        success: false,
        error: error.message || 'Failed to update knowledge document',
      });
    }
  },

  delete(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id } = req.params;
      const deleted = knowledgeService.delete(id);
      if (!deleted) {
        res.status(404).json({
          success: false,
          error: `Knowledge document not found with id: ${id}`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Knowledge document deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  },
};

