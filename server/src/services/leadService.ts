import { getDb } from '../db/database.js';
import type { LeadEntity, LeadDTO, LeadStatus, LeadScoreTier } from '../types/index.js';
import { leadEntityToDto } from '../utils/serializers.js';
import {
  isValidLeadStatus,
  isValidScore,
  isValidScoreTier,
  isValidEmail,
  deriveTierFromScore,
} from '../utils/validators.js';
import { activityService } from './activityService.js';

export interface LeadFilterOptions {
  search?: string;
  status?: string;
  industry?: string;
  tier?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface CreateLeadInput {
  id?: string;
  name: string;
  title: string;
  company: string;
  companyDomain?: string;
  avatar?: string;
  email: string;
  linkedin?: string;
  location?: string;
  industry: string;
  companySize?: string;
  score?: number;
  tier?: LeadScoreTier;
  status?: LeadStatus;
  dealValue?: number;
  triggers?: string[];
  notes?: string;
  lastActive?: string;
}

export interface UpdateLeadInput {
  name?: string;
  title?: string;
  company?: string;
  companyDomain?: string;
  avatar?: string;
  email?: string;
  linkedin?: string;
  location?: string;
  industry?: string;
  companySize?: string;
  score?: number;
  tier?: LeadScoreTier;
  status?: LeadStatus;
  dealValue?: number;
  triggers?: string[];
  notes?: string;
  lastActive?: string;
}

export const leadService = {
  getAll(filters: LeadFilterOptions = {}): { leads: LeadDTO[]; total: number } {
    const db = getDb();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.search && filters.search.trim()) {
      const term = `%${filters.search.trim()}%`;
      conditions.push('(name LIKE ? OR company LIKE ? OR email LIKE ? OR title LIKE ? OR notes LIKE ?)');
      params.push(term, term, term, term, term);
    }

    if (filters.status && isValidLeadStatus(filters.status)) {
      conditions.push('status = ?');
      params.push(filters.status);
    }

    if (filters.industry && filters.industry.trim()) {
      conditions.push('industry = ?');
      params.push(filters.industry.trim());
    }

    if (filters.tier && isValidScoreTier(filters.tier)) {
      conditions.push('tier = ?');
      params.push(filters.tier);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countStmt = db.prepare(`SELECT COUNT(*) as count FROM leads ${whereClause}`);
    const total = (countStmt.get(...params) as { count: number }).count;

    // Sanitize sort column to prevent SQL injection
    const allowedSortColumns: Record<string, string> = {
      score: 'score',
      dealvalue: 'deal_value',
      deal_value: 'deal_value',
      name: 'name',
      createdat: 'created_at',
      created_at: 'created_at',
      company: 'company',
      status: 'status',
    };

    const sortByParam = (filters.sortBy || 'score').toLowerCase().replace(/[^a-z_]/g, '');
    const sortCol = allowedSortColumns[sortByParam] || 'score';
    const sortDir = (filters.sortOrder || (sortCol === 'score' || sortCol === 'deal_value' ? 'desc' : 'asc')).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let paginationClause = '';
    const paginationParams: any[] = [];

    if (filters.limit !== undefined && filters.limit > 0) {
      paginationClause += ' LIMIT ?';
      paginationParams.push(filters.limit);

      if (filters.offset !== undefined && filters.offset >= 0) {
        paginationClause += ' OFFSET ?';
        paginationParams.push(filters.offset);
      }
    }

    const query = `
      SELECT * FROM leads
      ${whereClause}
      ORDER BY ${sortCol} ${sortDir}
      ${paginationClause}
    `;

    const rows = db.prepare(query).all(...params, ...paginationParams) as LeadEntity[];
    return {
      leads: rows.map(leadEntityToDto),
      total,
    };
  },

  getById(id: string): LeadDTO | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM leads WHERE id = ?').get(id) as LeadEntity | undefined;
    return row ? leadEntityToDto(row) : null;
  },

  create(data: CreateLeadInput): LeadDTO {
    const db = getDb();

    if (!data.name || !data.name.trim()) {
      throw new Error('Name is required');
    }
    if (!data.company || !data.company.trim()) {
      throw new Error('Company is required');
    }
    if (!data.email || !isValidEmail(data.email)) {
      throw new Error('A valid email address is required');
    }
    if (data.score !== undefined && !isValidScore(data.score)) {
      throw new Error('Score must be an integer between 0 and 100');
    }
    if (data.status !== undefined && !isValidLeadStatus(data.status)) {
      throw new Error(`Status must be one of: ${['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Disqualified'].join(', ')}`);
    }

    const id = data.id || `lead-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const score = data.score !== undefined ? data.score : 75;
    const tier = data.tier || deriveTierFromScore(score);
    const status = data.status || 'New';
    const dealValue = Math.max(0, Number(data.dealValue) || 0);
    const companyDomain = data.companyDomain || `${data.company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
    const triggersJson = JSON.stringify(data.triggers || []);

    const createTransaction = db.transaction(() => {
      const insertLead = db.prepare(`
        INSERT INTO leads (
          id, name, title, company, company_domain, avatar, email, linkedin,
          location, industry, company_size, score, tier, status, deal_value,
          triggers, notes, last_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);

      insertLead.run(
        id,
        data.name.trim(),
        data.title ? data.title.trim() : 'Decision Maker',
        data.company.trim(),
        companyDomain,
        data.avatar || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
        data.email.trim(),
        data.linkedin || `https://linkedin.com/company/${data.company.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        data.location || 'United States',
        data.industry || 'Technology',
        data.companySize || '100 - 250',
        score,
        tier,
        status,
        dealValue,
        triggersJson,
        data.notes || '',
        data.lastActive || 'Just now'
      );

      // Create linked opportunity for sales pipeline
      const oppId = `opp-${id}`;
      const insertOpp = db.prepare(`
        INSERT INTO opportunities (
          id, lead_id, title, stage, deal_value, confidence_score, expected_close_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+30 days'), datetime('now'), datetime('now'))
      `);

      insertOpp.run(
        oppId,
        id,
        `${data.name.trim()} • ${data.company.trim()}`,
        status,
        dealValue,
        score
      );
    });

    createTransaction();

    activityService.log(
      'discovery',
      'Lead Identified & Enriched',
      `${data.name} (${data.company}) added with ${score}/100 match score`,
      `${score} Match`
    );

    const created = this.getById(id);
    if (!created) {
      throw new Error('Failed to retrieve created lead');
    }
    return created;
  },

  update(id: string, updates: UpdateLeadInput): LeadDTO {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM leads WHERE id = ?').get(id) as LeadEntity | undefined;
    if (!existing) {
      throw new Error(`Lead not found with id: ${id}`);
    }

    if (updates.email !== undefined && !isValidEmail(updates.email)) {
      throw new Error('Invalid email address format');
    }
    if (updates.score !== undefined && !isValidScore(updates.score)) {
      throw new Error('Score must be an integer between 0 and 100');
    }
    if (updates.status !== undefined && !isValidLeadStatus(updates.status)) {
      throw new Error(`Status must be one of: ${['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Disqualified'].join(', ')}`);
    }
    if (updates.tier !== undefined && !isValidScoreTier(updates.tier)) {
      throw new Error('Tier must be high, medium, or low');
    }

    const newScore = updates.score !== undefined ? updates.score : existing.score;
    const newTier = updates.tier || (updates.score !== undefined ? deriveTierFromScore(updates.score) : existing.tier);
    const newStatus = updates.status || existing.status;
    const newDealValue = updates.dealValue !== undefined ? Math.max(0, updates.dealValue) : existing.deal_value;

    const fieldsToUpdate: string[] = ['updated_at = datetime(\'now\')'];
    const params: any[] = [];

    if (updates.name !== undefined) {
      fieldsToUpdate.push('name = ?');
      params.push(updates.name.trim());
    }
    if (updates.title !== undefined) {
      fieldsToUpdate.push('title = ?');
      params.push(updates.title.trim());
    }
    if (updates.company !== undefined) {
      fieldsToUpdate.push('company = ?');
      params.push(updates.company.trim());
    }
    if (updates.companyDomain !== undefined) {
      fieldsToUpdate.push('company_domain = ?');
      params.push(updates.companyDomain.trim());
    }
    if (updates.avatar !== undefined) {
      fieldsToUpdate.push('avatar = ?');
      params.push(updates.avatar);
    }
    if (updates.email !== undefined) {
      fieldsToUpdate.push('email = ?');
      params.push(updates.email.trim());
    }
    if (updates.linkedin !== undefined) {
      fieldsToUpdate.push('linkedin = ?');
      params.push(updates.linkedin);
    }
    if (updates.location !== undefined) {
      fieldsToUpdate.push('location = ?');
      params.push(updates.location);
    }
    if (updates.industry !== undefined) {
      fieldsToUpdate.push('industry = ?');
      params.push(updates.industry);
    }
    if (updates.companySize !== undefined) {
      fieldsToUpdate.push('company_size = ?');
      params.push(updates.companySize);
    }
    if (updates.score !== undefined) {
      fieldsToUpdate.push('score = ?');
      params.push(newScore);
    }
    fieldsToUpdate.push('tier = ?');
    params.push(newTier);

    if (updates.status !== undefined) {
      fieldsToUpdate.push('status = ?');
      params.push(newStatus);
    }
    if (updates.dealValue !== undefined) {
      fieldsToUpdate.push('deal_value = ?');
      params.push(newDealValue);
    }
    if (updates.triggers !== undefined) {
      fieldsToUpdate.push('triggers = ?');
      params.push(JSON.stringify(updates.triggers));
    }
    if (updates.notes !== undefined) {
      fieldsToUpdate.push('notes = ?');
      params.push(updates.notes);
    }
    if (updates.lastActive !== undefined) {
      fieldsToUpdate.push('last_active = ?');
      params.push(updates.lastActive);
    }

    const updateTx = db.transaction(() => {
      params.push(id);
      db.prepare(`UPDATE leads SET ${fieldsToUpdate.join(', ')} WHERE id = ?`).run(...params);

      // Sync linked opportunity if stage, title/company, or deal value changed
      const oppUpdates: string[] = ['updated_at = datetime(\'now\')'];
      const oppParams: any[] = [];

      if (updates.status !== undefined) {
        oppUpdates.push('stage = ?');
        oppParams.push(newStatus);
      }
      if (updates.dealValue !== undefined) {
        oppUpdates.push('deal_value = ?');
        oppParams.push(newDealValue);
      }
      if (updates.score !== undefined) {
        oppUpdates.push('confidence_score = ?');
        oppParams.push(newScore);
      }
      if (updates.name !== undefined || updates.company !== undefined) {
        const leadName = updates.name ? updates.name.trim() : existing.name;
        const comp = updates.company ? updates.company.trim() : existing.company;
        oppUpdates.push('title = ?');
        oppParams.push(`${leadName} • ${comp}`);
      }

      oppParams.push(id);
      db.prepare(`UPDATE opportunities SET ${oppUpdates.join(', ')} WHERE lead_id = ?`).run(...oppParams);
    });

    updateTx();

    // Log audit activity if status changed
    if (updates.status && updates.status !== existing.status) {
      activityService.log(
        'stage_change',
        `Deal Stage Updated: ${updates.status}`,
        `${existing.name} (${existing.company}) progressed from ${existing.status} to ${updates.status}`,
        updates.status
      );
    }

    const updated = this.getById(id);
    if (!updated) {
      throw new Error('Failed to retrieve updated lead');
    }
    return updated;
  },

  delete(id: string): boolean {
    const db = getDb();
    const existing = db.prepare('SELECT id, name, company FROM leads WHERE id = ?').get(id) as { id: string; name: string; company: string } | undefined;
    if (!existing) {
      return false;
    }

    const deleteTx = db.transaction(() => {
      db.prepare('DELETE FROM opportunities WHERE lead_id = ?').run(id);
      db.prepare('DELETE FROM leads WHERE id = ?').run(id);
    });

    deleteTx();
    return true;
  },
};

