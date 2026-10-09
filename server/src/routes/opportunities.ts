import { Router } from 'express';
import { opportunityController } from '../controllers/opportunityController.js';

export const opportunitiesRouter = Router();

// Pipeline summary endpoints
opportunitiesRouter.get('/opportunities/summary', opportunityController.getSummary);
opportunitiesRouter.get('/pipeline/summary', opportunityController.getSummary);

// Opportunity CRUD endpoints
opportunitiesRouter.get('/opportunities', opportunityController.getAll);
opportunitiesRouter.get('/opportunities/:id', opportunityController.getById);
opportunitiesRouter.post('/opportunities', opportunityController.create);
opportunitiesRouter.patch('/opportunities/:id', opportunityController.update);
opportunitiesRouter.delete('/opportunities/:id', opportunityController.delete);

