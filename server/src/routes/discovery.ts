import { Router } from 'express';
import { discoveryController } from '../controllers/discoveryController.js';

export const discoveryRouter = Router();

discoveryRouter.get('/discovery/providers', discoveryController.getProviders);
discoveryRouter.get('/discovery/capabilities', discoveryController.getCapabilities);
discoveryRouter.get('/discovery/jobs', discoveryController.getAllJobs);
discoveryRouter.post('/discovery/jobs', discoveryController.startJob);
discoveryRouter.post('/discovery/dry-run', discoveryController.runDryRun);
discoveryRouter.post('/discovery/cleanup-demo', discoveryController.cleanupDemoData);
discoveryRouter.get('/discovery/jobs/:id', discoveryController.getJob);
discoveryRouter.post('/discovery/jobs/:id/cancel', discoveryController.cancelJob);
discoveryRouter.post('/discovery/jobs/:id/retry', discoveryController.retryJob);
discoveryRouter.get('/discovery/jobs/:id/candidates', discoveryController.getCandidates);
discoveryRouter.get('/discovery/candidates', discoveryController.getAllCandidates);
discoveryRouter.post('/discovery/candidates/:id/ingest', discoveryController.ingestCandidate);
discoveryRouter.post('/discovery/candidates/ingest-batch', discoveryController.ingestBatch);


