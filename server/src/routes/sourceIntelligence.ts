import { Router } from 'express';
import { sourceIntelligenceController } from '../controllers/sourceIntelligenceController.js';
import { requireSourceIntelligence } from '../middleware/sourceIntelligenceFlag.js';

export const sourceIntelligenceRouter = Router();

// Public status check (returns { enabled: boolean })
sourceIntelligenceRouter.get('/source-intelligence/status', sourceIntelligenceController.getStatus);

// Gated routes requiring SOURCE_INTELLIGENCE_ENABLED=true
sourceIntelligenceRouter.use('/source-intelligence', requireSourceIntelligence);

// Source Registry Management
sourceIntelligenceRouter.get('/source-intelligence/sources', sourceIntelligenceController.getSources);
sourceIntelligenceRouter.patch('/source-intelligence/sources/:id', sourceIntelligenceController.toggleSource);
sourceIntelligenceRouter.post('/source-intelligence/sources/health', sourceIntelligenceController.checkHealth);

// Business Signals
sourceIntelligenceRouter.get('/source-intelligence/signals', sourceIntelligenceController.getSignals);
sourceIntelligenceRouter.post('/source-intelligence/signals', sourceIntelligenceController.ingestSignal);

// Strategy Plans
sourceIntelligenceRouter.post('/source-intelligence/plans/preview', sourceIntelligenceController.generatePlanPreview);
sourceIntelligenceRouter.post('/source-intelligence/plans', sourceIntelligenceController.createPlan);
sourceIntelligenceRouter.get('/source-intelligence/plans', sourceIntelligenceController.getPlans);
sourceIntelligenceRouter.get('/source-intelligence/plans/:id', sourceIntelligenceController.getPlan);
sourceIntelligenceRouter.post('/source-intelligence/plans/:id/execute', sourceIntelligenceController.executePlan);

// Sourcing Jobs
sourceIntelligenceRouter.get('/source-intelligence/jobs/:id', sourceIntelligenceController.getJob);

// Performance Analytics & Attribution
sourceIntelligenceRouter.get('/source-intelligence/analytics', sourceIntelligenceController.getAnalytics);

