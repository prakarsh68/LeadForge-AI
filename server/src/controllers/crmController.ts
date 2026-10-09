import type { Request, Response } from 'express';
import { getCrmConnector } from '../services/crm/crmService.js';
import { opportunityScoringService } from '../services/opportunityScoringService.js';
import { getDb } from '../db/database.js';
import { crmSyncRecordEntityToDto } from '../utils/serializers.js';

export const crmController = {
  async getStatus(_req: Request, res: Response): Promise<void> {
    try {
      const connector = getCrmConnector();
      const status = connector.getStatus();
      res.json({ success: true, data: status });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to get CRM status' });
    }
  },

  async syncLead(req: Request, res: Response): Promise<void> {
    try {
      const { leadId } = req.params;
      const connector = getCrmConnector();
      const result = await connector.syncLead(leadId);
      if (!result.success) {
        res.status(400).json({ success: false, error: result.error, data: result.syncRecord });
        return;
      }
      res.json({ success: true, data: result.syncRecord, isSimulated: result.isSimulated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to sync lead to CRM' });
    }
  },

  async getSyncRecordsForLead(req: Request, res: Response): Promise<void> {
    try {
      const { leadId } = req.params;
      const db = getDb();
      const rows = db
        .prepare('SELECT * FROM crm_sync_records WHERE lead_id = ? ORDER BY created_at DESC')
        .all(leadId) as any[];
      res.json({ success: true, data: rows.map((r) => crmSyncRecordEntityToDto(r)) });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch CRM sync records' });
    }
  },

  async getOpportunityScore(req: Request, res: Response): Promise<void> {
    try {
      const { leadId } = req.params;
      const score = opportunityScoringService.evaluateOpportunityScore(leadId);
      res.json({ success: true, data: score });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to evaluate opportunity score' });
    }
  },
};

