import { getDb } from '../db/database.js';
import type {
  OpportunityEntity,
  OpportunityDTO,
  PipelineSummaryDTO,
  LeadEntity,
  LeadStatus,
} from '../types/index.js';
import { opportunityEntityToDto } from '../utils/serializers.js';
import { isValidLeadStatus, isValidDealValue } from '../utils/validators.js';
import { activityService } from './activityService.js';

export interface CreateOpportunityInput {
  leadId: string;
  title?: string;
  stage?: LeadStatus;
  dealValue?: number;
  expectedCloseDate?: string;
}

export interface UpdateOpportunityInput {
  title?: string;
  stage?: LeadStatus;
  dealValue?: number;
  expectedCloseDate?: string;
}

export const opportunityService = {
  getAll(filters: { stage?: string } = {}): OpportunityDTO[] {
    const db = getDb();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.stage && isValidLeadStatus(filters.stage)) {
      conditions.push('o.stage = ?');
      params.push(filters.stage);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        o.*,
        l.name as lead_name,
        l.company as lead_company,
        l.avatar as lead_avatar,
        l.email as lead_email,
        l.score as lead_score,
        l.tier as lead_tier,
        l.industry as lead_industry
      FROM opportunities o
      LEFT JOIN leads l ON o.lead_id = l.id
      ${whereClause}
      ORDER BY o.deal_value DESC, o.updated_at DESC
    `;

    const rows = db.prepare(query).all(...params) as any[];

    return rows.map((row) => {
      const oppEntity: OpportunityEntity = {
        id: row.id,
        lead_id: row.lead_id,
        title: row.title,
        stage: row.stage,
        deal_value: row.deal_value,
        confidence_score: row.confidence_score,
        expected_close_date: row.expected_close_date,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };

      const partialLead: Partial<LeadEntity> = {
        name: row.lead_name,
        company: row.lead_company,
        avatar: row.lead_avatar,
        email: row.lead_email,
        score: row.lead_score,
        tier: row.lead_tier,
        industry: row.lead_industry,
      };

      return opportunityEntityToDto(oppEntity, partialLead);
    });
  },

  getById(id: string): OpportunityDTO | null {
    const db = getDb();
    const query = `
      SELECT 
        o.*,
        l.name as lead_name,
        l.company as lead_company,
        l.avatar as lead_avatar,
        l.email as lead_email,
        l.score as lead_score,
        l.tier as lead_tier,
        l.industry as lead_industry
      FROM opportunities o
      LEFT JOIN leads l ON o.lead_id = l.id
      WHERE o.id = ?
    `;

    const row = db.prepare(query).get(id) as any;
    if (!row) return null;

    const oppEntity: OpportunityEntity = {
      id: row.id,
      lead_id: row.lead_id,
      title: row.title,
      stage: row.stage,
      deal_value: row.deal_value,
      confidence_score: row.confidence_score,
      expected_close_date: row.expected_close_date,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    const partialLead: Partial<LeadEntity> = {
      name: row.lead_name,
      company: row.lead_company,
      avatar: row.lead_avatar,
      email: row.lead_email,
      score: row.lead_score,
      tier: row.lead_tier,
      industry: row.lead_industry,
    };

    return opportunityEntityToDto(oppEntity, partialLead);
  },

  getSummary(): PipelineSummaryDTO {
    const db = getDb();
    const rows = db.prepare('SELECT stage, deal_value FROM opportunities').all() as Array<{
      stage: LeadStatus;
      deal_value: number;
    }>;

    const stages: LeadStatus[] = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Disqualified'];
    const stageCounts: Record<LeadStatus, number> = {
      New: 0,
      Contacted: 0,
      Qualified: 0,
      Proposal: 0,
      Won: 0,
      Disqualified: 0,
    };
    const stageValues: Record<LeadStatus, number> = {
      New: 0,
      Contacted: 0,
      Qualified: 0,
      Proposal: 0,
      Won: 0,
      Disqualified: 0,
    };

    let totalPipelineValue = 0;
    let wonCount = 0;

    for (const row of rows) {
      if (stages.includes(row.stage)) {
        stageCounts[row.stage] += 1;
        stageValues[row.stage] += row.deal_value || 0;
      }
      totalPipelineValue += row.deal_value || 0;
      if (row.stage === 'Won') {
        wonCount += 1;
      }
    }

    const totalOpportunities = rows.length;
    const averageDealValue = totalOpportunities > 0 ? Math.round(totalPipelineValue / totalOpportunities) : 0;
    const winRate = totalOpportunities > 0 ? Math.round((wonCount / totalOpportunities) * 100) : 0;

    return {
      totalPipelineValue,
      totalOpportunities,
      stageCounts,
      stageValues,
      winRate,
      averageDealValue,
    };
  },

  create(data: CreateOpportunityInput): OpportunityDTO {
    const db = getDb();

    if (!data.leadId) {
      throw new Error('leadId is required');
    }

    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(data.leadId) as LeadEntity | undefined;
    if (!lead) {
      throw new Error(`Referenced lead not found with id: ${data.leadId}`);
    }

    // Check if opportunity already exists for this lead
    const existing = db.prepare('SELECT id FROM opportunities WHERE lead_id = ?').get(data.leadId) as { id: string } | undefined;
    if (existing) {
      throw new Error(`An opportunity already exists for lead: ${data.leadId}`);
    }

    if (data.stage && !isValidLeadStatus(data.stage)) {
      throw new Error('Invalid opportunity stage');
    }
    if (data.dealValue !== undefined && !isValidDealValue(data.dealValue)) {
      throw new Error('Deal value must be non-negative');
    }

    const id = `opp-${data.leadId}`;
    const stage = data.stage || lead.status;
    const dealValue = data.dealValue !== undefined ? data.dealValue : lead.deal_value;
    const title = data.title ? data.title.trim() : `${lead.name} • ${lead.company}`;

    const createTx = db.transaction(() => {
      const insertOpp = db.prepare(`
        INSERT INTO opportunities (
          id, lead_id, title, stage, deal_value, confidence_score, expected_close_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);

      insertOpp.run(
        id,
        data.leadId,
        title,
        stage,
        dealValue,
        lead.score,
        data.expectedCloseDate || null
      );

      // Keep lead synchronized
      db.prepare(`
        UPDATE leads SET status = ?, deal_value = ?, updated_at = datetime('now') WHERE id = ?
      `).run(stage, dealValue, data.leadId);
    });

    createTx();

    const created = this.getById(id);
    if (!created) {
      throw new Error('Failed to retrieve newly created opportunity');
    }
    return created;
  },

  update(id: string, updates: UpdateOpportunityInput): OpportunityDTO {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM opportunities WHERE id = ?').get(id) as OpportunityEntity | undefined;
    if (!existing) {
      throw new Error(`Opportunity not found with id: ${id}`);
    }

    if (updates.stage !== undefined && !isValidLeadStatus(updates.stage)) {
      throw new Error('Invalid opportunity stage');
    }
    if (updates.dealValue !== undefined && !isValidDealValue(updates.dealValue)) {
      throw new Error('Deal value must be non-negative');
    }

    const newStage = updates.stage || existing.stage;
    const newDealValue = updates.dealValue !== undefined ? updates.dealValue : existing.deal_value;

    const fieldsToUpdate: string[] = ['updated_at = datetime(\'now\')'];
    const params: any[] = [];

    if (updates.title !== undefined) {
      fieldsToUpdate.push('title = ?');
      params.push(updates.title.trim());
    }
    if (updates.stage !== undefined) {
      fieldsToUpdate.push('stage = ?');
      params.push(newStage);
    }
    if (updates.dealValue !== undefined) {
      fieldsToUpdate.push('deal_value = ?');
      params.push(newDealValue);
    }
    if (updates.expectedCloseDate !== undefined) {
      fieldsToUpdate.push('expected_close_date = ?');
      params.push(updates.expectedCloseDate);
    }

    const updateTx = db.transaction(() => {
      params.push(id);
      db.prepare(`UPDATE opportunities SET ${fieldsToUpdate.join(', ')} WHERE id = ?`).run(...params);

      // Synchronize linked lead's stage and deal value
      const leadUpdates: string[] = ['updated_at = datetime(\'now\')'];
      const leadParams: any[] = [];

      if (updates.stage !== undefined) {
        leadUpdates.push('status = ?');
        leadParams.push(newStage);
      }
      if (updates.dealValue !== undefined) {
        leadUpdates.push('deal_value = ?');
        leadParams.push(newDealValue);
      }

      leadParams.push(existing.lead_id);
      db.prepare(`UPDATE leads SET ${leadUpdates.join(', ')} WHERE id = ?`).run(...leadParams);
    });

    updateTx();

    // Log stage change activity if stage transitioned
    if (updates.stage && updates.stage !== existing.stage) {
      activityService.log(
        'stage_change',
        `Deal Stage Transition: ${updates.stage}`,
        `Opportunity "${existing.title}" moved from ${existing.stage} to ${updates.stage}`,
        updates.stage
      );
    }

    const updated = this.getById(id);
    if (!updated) {
      throw new Error('Failed to retrieve updated opportunity');
    }
    return updated;
  },

  delete(id: string): boolean {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM opportunities WHERE id = ?').get(id);
    if (!existing) {
      return false;
    }
    db.prepare('DELETE FROM opportunities WHERE id = ?').run(id);
    return true;
  },
};

