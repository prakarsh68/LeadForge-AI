import type { Request, Response } from 'express';
import { campaignService } from '../services/outreach/campaignService.js';
import { sequenceQueueService } from '../services/outreach/sequenceQueueService.js';
import { emailGeneratorService } from '../services/outreach/emailGeneratorService.js';
import { engagementService } from '../services/outreach/engagementService.js';
import { outreachAnalyticsService } from '../services/outreach/outreachAnalyticsService.js';
import { leadService } from '../services/leadService.js';
import { agenticOutreachService } from '../services/outreach/agenticOutreachService.js';

export const outreachController = {
  // Campaigns
  async listCampaigns(_req: Request, res: Response): Promise<void> {
    try {
      const campaigns = campaignService.listCampaigns();
      res.json({ success: true, data: campaigns });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to list campaigns' });
    }
  },

  async getCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const campaign = campaignService.getCampaignById(id);
      if (!campaign) {
        res.status(404).json({ success: false, error: 'Campaign not found' });
        return;
      }
      res.json({ success: true, data: campaign });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to get campaign' });
    }
  },

  async createCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, targetIcpId, status, sendingLimits, scheduleWindow } = req.body;
      if (!name || typeof name !== 'string') {
        res.status(400).json({ success: false, error: 'Campaign name is required' });
        return;
      }
      const created = campaignService.createCampaign({
        name,
        description,
        targetIcpId,
        status,
        sendingLimits,
        scheduleWindow,
      });
      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to create campaign' });
    }
  },

  async updateCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updated = campaignService.updateCampaign(id, req.body);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to update campaign' });
    }
  },

  async deleteCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const ok = campaignService.deleteCampaign(id);
      res.json({ success: ok, message: ok ? 'Campaign deleted' : 'Campaign not found' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to delete campaign' });
    }
  },

  // Sequences
  async listSequences(req: Request, res: Response): Promise<void> {
    try {
      const { campaignId, leadId, status } = req.query as {
        campaignId?: string;
        leadId?: string;
        status?: string;
      };
      const sequences = sequenceQueueService.listSequences({ campaignId, leadId, status });
      res.json({ success: true, data: sequences });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to list sequences' });
    }
  },

  async getSequence(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const sequence = sequenceQueueService.getSequenceById(id);
      if (!sequence) {
        res.status(404).json({ success: false, error: 'Sequence not found' });
        return;
      }
      res.json({ success: true, data: sequence });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to get sequence' });
    }
  },

  async createSequence(req: Request, res: Response): Promise<void> {
    try {
      const { leadId, campaignId, generateDrafts, customInstructions } = req.body;
      if (!leadId) {
        res.status(400).json({ success: false, error: 'leadId is required' });
        return;
      }

      const lead = leadService.getById(leadId);
      if (!lead) {
        res.status(404).json({ success: false, error: 'Lead not found' });
        return;
      }

      let generatedSteps: any[] | undefined;
      if (generateDrafts !== false) {
        const draftResult = await emailGeneratorService.generateSequence(lead, {
          customInstructions,
        });
        generatedSteps = draftResult.steps;
      }

      const sequence = sequenceQueueService.createSequence(leadId, campaignId, generatedSteps);
      res.status(201).json({ success: true, data: sequence });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to create sequence' });
    }
  },

  async approveSequence(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const approvedBy = req.body?.approvedBy || 'sales_operator';
      const sequence = sequenceQueueService.approveSequence(id, approvedBy);
      res.json({ success: true, data: sequence });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to approve sequence' });
    }
  },

  async pauseSequence(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const sequence = sequenceQueueService.pauseSequence(id);
      res.json({ success: true, data: sequence });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to pause sequence' });
    }
  },

  async resumeSequence(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const sequence = sequenceQueueService.resumeSequence(id);
      res.json({ success: true, data: sequence });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to resume sequence' });
    }
  },

  async cancelSequence(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const reason = req.body?.reason || 'User cancelled';
      const sequence = sequenceQueueService.cancelSequence(id, reason);
      res.json({ success: true, data: sequence });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to cancel sequence' });
    }
  },

  async updateMessage(req: Request, res: Response): Promise<void> {
    try {
      const { id, step } = req.params;
      const stepNumber = parseInt(step, 10);
      if (isNaN(stepNumber) || stepNumber < 1 || stepNumber > 3) {
        res.status(400).json({ success: false, error: 'Invalid step number (must be 1, 2, or 3)' });
        return;
      }
      const updated = sequenceQueueService.updateMessage(id, stepNumber, req.body);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to update message' });
    }
  },

  async sendNow(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await sequenceQueueService.sendNextStep(id);
      if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }
      const updatedSequence = sequenceQueueService.getSequenceById(id);
      res.json({ success: true, data: updatedSequence, messageId: result.messageId });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to dispatch email' });
    }
  },

  // Draft Generation
  async generateDraft(req: Request, res: Response): Promise<void> {
    try {
      const { leadId, customInstructions } = req.body;
      if (!leadId) {
        res.status(400).json({ success: false, error: 'leadId is required' });
        return;
      }

      const lead = leadService.getById(leadId);
      if (!lead) {
        res.status(404).json({ success: false, error: 'Lead not found' });
        return;
      }

      const draftResult = await emailGeneratorService.generateSequence(lead, {
        customInstructions,
      });

      res.json({ success: true, data: draftResult });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to generate drafts' });
    }
  },

  // Agentic Autonomous Dispatch & CRM Sync
  async agenticSend(req: Request, res: Response): Promise<void> {
    try {
      const { leadId, sequenceId, campaignId, customInstructions, autoSyncCrm } = req.body;
      if (!leadId && !sequenceId) {
        res.status(400).json({ success: false, error: 'Either leadId or sequenceId is required for agentic dispatch' });
        return;
      }

      const result = await agenticOutreachService.executeAgenticSend({
        leadId,
        sequenceId,
        campaignId,
        customInstructions,
        autoSyncCrm: autoSyncCrm !== undefined ? Boolean(autoSyncCrm) : true,
      });

      if (!result.success) {
        res.status(400).json({ success: false, error: result.error, data: result });
        return;
      }

      res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Autonomous agentic dispatch failed' });
    }
  },

  // Engagement Events & Webhook
  async recordEvent(req: Request, res: Response): Promise<void> {
    try {
      const { leadId, sequenceId, messageId, campaignId, eventType, providerEventId, sourceMetadata } = req.body;
      if (!leadId || !eventType) {
        res.status(400).json({ success: false, error: 'leadId and eventType are required' });
        return;
      }

      const result = await engagementService.recordEvent({
        leadId,
        sequenceId,
        messageId,
        campaignId,
        eventType,
        providerEventId,
        sourceMetadata,
      });

      res.status(200).json({ success: true, data: result.event, isDuplicate: result.isDuplicate });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to record event' });
    }
  },

  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { provider } = req.params;
      const body = req.body;

      // Extract details depending on provider format (e.g. Resend webhook format)
      let eventType: any = 'delivered';
      let providerEventId: string | null = null;
      let leadId: string = '';
      let sequenceId: string | null = null;

      if (provider === 'resend') {
        const type = body.type; // email.delivered, email.bounced, email.opened, email.clicked
        if (type === 'email.delivered') eventType = 'delivered';
        else if (type === 'email.bounced') eventType = 'bounced';
        else if (type === 'email.opened') eventType = 'opened';
        else if (type === 'email.clicked') eventType = 'clicked';
        else if (type === 'email.complained') eventType = 'unsubscribed';

        providerEventId = body.id || (body.data && body.data.email_id);
        leadId = body.data?.tags?.leadId || '';
        sequenceId = body.data?.tags?.sequenceId || null;
      } else {
        // Generic format
        eventType = body.eventType || 'opened';
        providerEventId = body.providerEventId || body.id;
        leadId = body.leadId;
        sequenceId = body.sequenceId;
      }

      if (!leadId) {
        // Acknowledge webhook anyway to avoid repetitive retries from provider
        res.json({ success: true, message: 'Acknowledged without lead match' });
        return;
      }

      const result = await engagementService.recordEvent({
        leadId,
        sequenceId,
        eventType,
        providerEventId,
        sourceMetadata: body,
      });

      res.json({ success: true, isDuplicate: result.isDuplicate });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Webhook processing failure' });
    }
  },

  // Suppression
  async listSuppression(_req: Request, res: Response): Promise<void> {
    try {
      const list = engagementService.getSuppressionList();
      res.json({ success: true, data: list });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to list suppression list' });
    }
  },

  async addSuppression(req: Request, res: Response): Promise<void> {
    try {
      const { email, reason, source } = req.body;
      if (!email || typeof email !== 'string') {
        res.status(400).json({ success: false, error: 'Valid email is required' });
        return;
      }
      const item = engagementService.addToSuppressionList(email, reason || 'manual', source || 'user');
      res.status(201).json({ success: true, data: item });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to add suppression entry' });
    }
  },

  async removeSuppression(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const ok = engagementService.removeFromSuppressionList(id);
      res.json({ success: ok, message: ok ? 'Removed from suppression list' : 'Entry not found' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to remove suppression entry' });
    }
  },

  // Analytics
  async getAnalytics(_req: Request, res: Response): Promise<void> {
    try {
      const analytics = outreachAnalyticsService.getAnalytics();
      res.json({ success: true, data: analytics });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to compute analytics' });
    }
  },
};
