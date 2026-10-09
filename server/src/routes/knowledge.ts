import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { knowledgeController } from '../controllers/knowledgeController.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB max file size
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.pdf', '.docx', '.doc', '.txt', '.md', '.markdown'];
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Unsupported file type: ${ext}. Supported types: PDF (.pdf), Word (.docx), Plain Text (.txt), Markdown (.md)`
        )
      );
    }
  },
});

export const knowledgeRouter = Router();

// Phase 4: Knowledge Intelligence Engine routes
knowledgeRouter.get('/knowledge/config', knowledgeController.getConfig);
knowledgeRouter.post('/knowledge/upload', upload.single('file'), knowledgeController.upload);
knowledgeRouter.post('/knowledge/search', knowledgeController.search);
knowledgeRouter.get('/knowledge/search', knowledgeController.search);
knowledgeRouter.post('/knowledge/ask', knowledgeController.ask);

// Chunks, Re-index, Retry
knowledgeRouter.get('/knowledge/documents/:id/chunks', knowledgeController.getChunks);
knowledgeRouter.post('/knowledge/documents/:id/reindex', knowledgeController.reindex);
knowledgeRouter.post('/knowledge/documents/:id/retry', knowledgeController.retry);

knowledgeRouter.get('/knowledge-documents/:id/chunks', knowledgeController.getChunks);
knowledgeRouter.post('/knowledge-documents/:id/reindex', knowledgeController.reindex);
knowledgeRouter.post('/knowledge-documents/:id/retry', knowledgeController.retry);

// Existing CRUD endpoints (preserved for full backward compatibility)
knowledgeRouter.get('/knowledge-documents', knowledgeController.getAll);
knowledgeRouter.get('/knowledge-documents/:id', knowledgeController.getById);
knowledgeRouter.post('/knowledge-documents', knowledgeController.create);
knowledgeRouter.patch('/knowledge-documents/:id', knowledgeController.update);
knowledgeRouter.delete('/knowledge-documents/:id', knowledgeController.delete);

// REST aliases
knowledgeRouter.get('/knowledge/documents', knowledgeController.getAll);
knowledgeRouter.get('/knowledge/documents/:id', knowledgeController.getById);
knowledgeRouter.post('/knowledge/documents', knowledgeController.create);
knowledgeRouter.patch('/knowledge/documents/:id', knowledgeController.update);
knowledgeRouter.delete('/knowledge/documents/:id', knowledgeController.delete);
