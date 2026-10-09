import { Router } from 'express';
import { crmController } from '../controllers/crmController.js';

export const crmRouter = Router();

// CRM Operations
crmRouter.get('/crm/status', (req, res) => crmController.getStatus(req, res));
crmRouter.post('/crm/sync/:leadId', (req, res) => crmController.syncLead(req, res));
crmRouter.get('/crm/leads/:leadId/records', (req, res) => crmController.getSyncRecordsForLead(req, res));

// Opportunity Scoring
crmRouter.get('/opportunities/:leadId/score', (req, res) => crmController.getOpportunityScore(req, res));
crmRouter.post('/opportunities/:leadId/score', (req, res) => crmController.getOpportunityScore(req, res));

