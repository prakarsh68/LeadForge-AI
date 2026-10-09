import { Router } from 'express';
import { discoveryController } from '../controllers/discoveryController.js';

export const discoveryRouter = Router();

discoveryRouter.get('/discovery/providers', discoveryController.getProviders);
discoveryRouter.post('/discovery/jobs', discoveryController.startJob);
discoveryRouter.get('/discovery/jobs/:id', discoveryController.getJob);
discoveryRouter.get('/discovery/jobs/:id/candidates', discoveryController.getCandidates);
discoveryRouter.post('/discovery/candidates/:id/ingest', discoveryController.ingestCandidate);
