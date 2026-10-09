import { Router } from 'express';
import { icpController } from '../controllers/icpController.js';

export const icpRouter = Router();

icpRouter.get('/icp-profiles', icpController.getAll);
icpRouter.get('/icp-profiles/active', icpController.getActive);
icpRouter.get('/icp-profiles/:id', icpController.getById);
icpRouter.post('/icp-profiles', icpController.create);
icpRouter.patch('/icp-profiles/:id', icpController.update);
icpRouter.delete('/icp-profiles/:id', icpController.delete);
