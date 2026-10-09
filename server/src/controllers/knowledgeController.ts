import type { Request, Response, NextFunction } from 'express';
import { knowledgeService } from '../services/knowledgeService.js';
import { knowledgePipelineService } from '../services/knowledge/knowledgePipelineService.js';
import { retrievalService } from '../services/knowledge/retrievalService.js';
import { ragService } from '../services/knowledge/ragService.js';
import { ALLOWED_DOC_CATEGORIES } from '../utils/validators.js';

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

  create(req: Request, res: Response, _next: NextFunction): void {
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

  update(req: Request, res: Response, _next: NextFunction): void {
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

  // Phase 4: Multipart File Upload & Ingestion
  async upload(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No file uploaded. Please provide a PDF, DOCX, TXT, or MD file.',
        });
        return;
      }

      const category = (req.body.category || 'Product Specs') as any;
      if (!ALLOWED_DOC_CATEGORIES.includes(category)) {
        res.status(400).json({
          success: false,
          error: `Invalid category. Must be one of: ${ALLOWED_DOC_CATEGORIES.join(', ')}`,
        });
        return;
      }

      const ingested = await knowledgePipelineService.ingestFile({
        fileBuffer: req.file.buffer,
        originalName: req.file.originalname,
        title: req.body.title,
        category,
        summary: req.body.summary,
        mimeType: req.file.mimetype,
      });

      res.status(201).json({
        success: true,
        data: ingested,
        message: 'Knowledge document uploaded and indexed successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to ingest knowledge document',
      });
    }
  },

  // Phase 4: Chunks Inspection
  getChunks(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id } = req.params;
      const chunks = knowledgePipelineService.getChunks(id);
      res.status(200).json({
        success: true,
        data: chunks,
        meta: {
          total: chunks.length,
          documentId: id,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // Phase 4: Re-index Document
  async reindex(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const reindexed = await knowledgePipelineService.reindexDocument(id);
      res.status(200).json({
        success: true,
        data: reindexed,
        message: 'Knowledge document re-indexed successfully',
      });
    } catch (error: any) {
      const isNotFound = error.message && error.message.includes('not found');
      res.status(isNotFound ? 404 : 500).json({
        success: false,
        error: error.message || 'Failed to re-index document',
      });
    }
  },

  // Phase 4: Retry Failed Document
  async retry(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const retried = await knowledgePipelineService.retryDocument(id);
      res.status(200).json({
        success: true,
        data: retried,
        message: 'Knowledge document retried successfully',
      });
    } catch (error: any) {
      const isNotFound = error.message && error.message.includes('not found');
      res.status(isNotFound ? 404 : 500).json({
        success: false,
        error: error.message || 'Failed to retry document processing',
      });
    }
  },

  // Phase 4: Semantic & Keyword Search
  async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req.body.query || req.query.q || '').toString();
      if (!query.trim()) {
        res.status(400).json({
          success: false,
          error: 'Search query is required',
        });
        return;
      }

      const category = (req.body.category || req.query.category)?.toString();
      const limitRaw = req.body.limit ?? req.query.limit;
      const limit = limitRaw ? parseInt(limitRaw.toString(), 10) : 5;
      const minSimilarityRaw = req.body.minSimilarity ?? req.query.minSimilarity;
      const minSimilarity = minSimilarityRaw ? parseFloat(minSimilarityRaw.toString()) : undefined;

      const results = await retrievalService.search(query, {
        category,
        limit,
        minSimilarity,
      });

      res.status(200).json({
        success: true,
        data: results,
        meta: {
          total: results.length,
          query,
          searchMode: results[0]?.searchMode || 'keyword',
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // Phase 4: Grounded RAG Q&A
  async ask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const question = req.body.question?.toString() || '';
      if (!question.trim()) {
        res.status(400).json({
          success: false,
          error: 'Question is required',
        });
        return;
      }

      const category = req.body.category?.toString();
      const topK = req.body.topK ? parseInt(req.body.topK.toString(), 10) : 4;
      const minSimilarity = req.body.minSimilarity ? parseFloat(req.body.minSimilarity.toString()) : undefined;

      const result = await ragService.ask(question, {
        category,
        topK,
        minSimilarity,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  // Phase 4: Configuration & Telemetry
  getConfig(_req: Request, res: Response, next: NextFunction): void {
    try {
      const config = knowledgePipelineService.getConfig();
      res.status(200).json({
        success: true,
        data: config,
      });
    } catch (error) {
      next(error);
    }
  },
};
