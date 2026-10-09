import { Router } from 'express';
import { knowledgeController } from '../controllers/knowledgeController.js';

export const knowledgeRouter = Router();

knowledgeRouter.get('/knowledge-documents', knowledgeController.getAll);
knowledgeRouter.get('/knowledge-documents/:id', knowledgeController.getById);
knowledgeRouter.post('/knowledge-documents', knowledgeController.create);
knowledgeRouter.patch('/knowledge-documents/:id', knowledgeController.update);
knowledgeRouter.delete('/knowledge-documents/:id', knowledgeController.delete);

