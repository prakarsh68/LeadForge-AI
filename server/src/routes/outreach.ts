import { Router } from 'express';
import { outreachController } from '../controllers/outreachController.js';

export const outreachRouter = Router();

// Campaigns
outreachRouter.get('/outreach/campaigns', (req, res) => outreachController.listCampaigns(req, res));
outreachRouter.post('/outreach/campaigns', (req, res) => outreachController.createCampaign(req, res));
outreachRouter.get('/outreach/campaigns/:id', (req, res) => outreachController.getCampaign(req, res));
outreachRouter.put('/outreach/campaigns/:id', (req, res) => outreachController.updateCampaign(req, res));
outreachRouter.delete('/outreach/campaigns/:id', (req, res) => outreachController.deleteCampaign(req, res));

// Sequences
outreachRouter.get('/outreach/sequences', (req, res) => outreachController.listSequences(req, res));
outreachRouter.post('/outreach/sequences', (req, res) => outreachController.createSequence(req, res));
outreachRouter.get('/outreach/sequences/:id', (req, res) => outreachController.getSequence(req, res));
outreachRouter.post('/outreach/sequences/:id/approve', (req, res) => outreachController.approveSequence(req, res));
outreachRouter.post('/outreach/sequences/:id/pause', (req, res) => outreachController.pauseSequence(req, res));
outreachRouter.post('/outreach/sequences/:id/resume', (req, res) => outreachController.resumeSequence(req, res));
outreachRouter.post('/outreach/sequences/:id/cancel', (req, res) => outreachController.cancelSequence(req, res));
outreachRouter.post('/outreach/sequences/:id/send-now', (req, res) => outreachController.sendNow(req, res));
outreachRouter.put('/outreach/sequences/:id/messages/:step', (req, res) => outreachController.updateMessage(req, res));

// Draft Generation
outreachRouter.post('/outreach/generate', (req, res) => outreachController.generateDraft(req, res));

// Engagement & Webhooks
outreachRouter.post('/outreach/events', (req, res) => outreachController.recordEvent(req, res));
outreachRouter.post('/outreach/webhooks/:provider', (req, res) => outreachController.handleWebhook(req, res));

// Suppression List
outreachRouter.get('/outreach/suppression', (req, res) => outreachController.listSuppression(req, res));
outreachRouter.post('/outreach/suppression', (req, res) => outreachController.addSuppression(req, res));
outreachRouter.delete('/outreach/suppression/:id', (req, res) => outreachController.removeSuppression(req, res));

// Analytics
outreachRouter.get('/outreach/analytics', (req, res) => outreachController.getAnalytics(req, res));

