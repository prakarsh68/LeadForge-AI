import { Router } from 'express';
import { agenticSourcingController } from '../controllers/agenticSourcingController.js';
import { requireAgenticSourcing } from '../middleware/agenticSourcingFlag.js';

export const agenticSourcingRouter = Router();

// Public status check (returns enabled status and metrics)
agenticSourcingRouter.get('/agentic-sourcing/status', agenticSourcingController.getStatus);

// Gated routes requiring AGENTIC_SOURCING_ENABLED=true
agenticSourcingRouter.use('/agentic-sourcing', requireAgenticSourcing);

// Intent parsing
agenticSourcingRouter.post('/agentic-sourcing/intent/parse', agenticSourcingController.parseIntent);

// Sourcing Runs
agenticSourcingRouter.post('/agentic-sourcing/runs', agenticSourcingController.createRun);
agenticSourcingRouter.get('/agentic-sourcing/runs', agenticSourcingController.getAllRuns);
agenticSourcingRouter.get('/agentic-sourcing/runs/:id', agenticSourcingController.getRun);
agenticSourcingRouter.post('/agentic-sourcing/runs/:id/execute', agenticSourcingController.executeRun);
agenticSourcingRouter.post('/agentic-sourcing/runs/:id/cancel', agenticSourcingController.cancelRun);

// Optimization Weights
agenticSourcingRouter.get('/agentic-sourcing/optimization/weights', agenticSourcingController.getWeights);
agenticSourcingRouter.post('/agentic-sourcing/optimization/recompute', agenticSourcingController.recomputeWeights);

// Experiments
agenticSourcingRouter.post('/agentic-sourcing/experiments/run', agenticSourcingController.runExperiment);
agenticSourcingRouter.get('/agentic-sourcing/experiments', agenticSourcingController.getExperiments);

