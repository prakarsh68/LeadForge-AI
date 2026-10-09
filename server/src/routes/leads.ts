import { Router } from 'express';
import { leadController } from '../controllers/leadController.js';

export const leadsRouter = Router();

leadsRouter.get('/leads', leadController.getAll);
leadsRouter.get('/leads/:id', leadController.getById);
leadsRouter.post('/leads', leadController.create);
leadsRouter.patch('/leads/:id', leadController.update);
leadsRouter.delete('/leads/:id', leadController.delete);
