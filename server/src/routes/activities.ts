import { Router } from 'express';
import { activityController } from '../controllers/activityController.js';

export const activitiesRouter = Router();

activitiesRouter.get('/activities', activityController.getAll);
activitiesRouter.post('/activities', activityController.create);

