import { getDb } from '../db/database.js';
import type { IcpProfileEntity, IcpProfileDTO } from '../types/index.js';
import { icpEntityToDto } from '../utils/serializers.js';
import { isValidScore } from '../utils/validators.js';
import { activityService } from './activityService.js';

export interface CreateIcpInput {
  name: string;
  description: string;
  targetIndustries?: string[];
  companySizeRanges?: string[];
  targetLocations?: string[];
  revenueRanges?: string[];
  targetRoles?: string[];
  seniorityLevels?: string[];
  buyingTriggers?: string[];
  techStack?: string[];
  minScoreThreshold?: number;
  negativeKeywords?: string[];
  isActive?: boolean;
}

export interface UpdateIcpInput {
  name?: string;
  description?: string;
  targetIndustries?: string[];
  companySizeRanges?: string[];
  targetLocations?: string[];
  revenueRanges?: string[];
  targetRoles?: string[];
  seniorityLevels?: string[];
  buyingTriggers?: string[];
  techStack?: string[];
  minScoreThreshold?: number;
  negativeKeywords?: string[];
  isActive?: boolean;
}

export const icpService = {
  getAll(): IcpProfileDTO[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM icp_profiles ORDER BY is_active DESC, created_at DESC').all() as IcpProfileEntity[];
    return rows.map(icpEntityToDto);
  },

  getActive(): IcpProfileDTO | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM icp_profiles WHERE is_active = 1 LIMIT 1').get() as IcpProfileEntity | undefined;
    if (row) return icpEntityToDto(row);

    // Fallback to first profile if none marked active
    const first = db.prepare('SELECT * FROM icp_profiles ORDER BY created_at ASC LIMIT 1').get() as IcpProfileEntity | undefined;
    return first ? icpEntityToDto(first) : null;
  },

  getById(id: string): IcpProfileDTO | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM icp_profiles WHERE id = ?').get(id) as IcpProfileEntity | undefined;
    return row ? icpEntityToDto(row) : null;
  },

  create(data: CreateIcpInput): IcpProfileDTO {
    const db = getDb();

    if (!data.name || !data.name.trim()) {
      throw new Error('Profile name is required');
    }
    if (!data.description || !data.description.trim()) {
      throw new Error('Profile description is required');
    }
    if (data.minScoreThreshold !== undefined && !isValidScore(data.minScoreThreshold)) {
      throw new Error('Minimum score threshold must be between 0 and 100');
    }

    const id = `icp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const shouldBeActive = data.isActive ?? false;

    const createTx = db.transaction(() => {
      // If this new profile is active, deactivate all other profiles atomically
      if (shouldBeActive) {
        db.prepare('UPDATE icp_profiles SET is_active = 0').run();
      }

      const insertStmt = db.prepare(`
        INSERT INTO icp_profiles (
          id, name, description, target_industries, company_size_ranges,
          target_locations, revenue_ranges, target_roles, seniority_levels,
          buying_triggers, tech_stack, min_score_threshold, negative_keywords,
          is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);

      insertStmt.run(
        id,
        data.name.trim(),
        data.description.trim(),
        JSON.stringify(data.targetIndustries || []),
        JSON.stringify(data.companySizeRanges || []),
        JSON.stringify(data.targetLocations || []),
        JSON.stringify(data.revenueRanges || []),
        JSON.stringify(data.targetRoles || []),
        JSON.stringify(data.seniorityLevels || []),
        JSON.stringify(data.buyingTriggers || []),
        JSON.stringify(data.techStack || []),
        data.minScoreThreshold !== undefined ? data.minScoreThreshold : 75,
        JSON.stringify(data.negativeKeywords || []),
        shouldBeActive ? 1 : 0
      );
    });

    createTx();

    activityService.log(
      'score',
      'ICP Profile Configured',
      `Targeting profile "${data.name}" saved with threshold ${data.minScoreThreshold ?? 75}`,
      'ICP Saved'
    );

    const created = this.getById(id);
    if (!created) {
      throw new Error('Failed to retrieve newly created ICP profile');
    }
    return created;
  },

  update(id: string, updates: UpdateIcpInput): IcpProfileDTO {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM icp_profiles WHERE id = ?').get(id) as IcpProfileEntity | undefined;
    if (!existing) {
      throw new Error(`ICP profile not found with id: ${id}`);
    }

    if (updates.minScoreThreshold !== undefined && !isValidScore(updates.minScoreThreshold)) {
      throw new Error('Minimum score threshold must be between 0 and 100');
    }

    const fieldsToUpdate: string[] = ['updated_at = datetime(\'now\')'];
    const params: any[] = [];

    if (updates.name !== undefined) {
      fieldsToUpdate.push('name = ?');
      params.push(updates.name.trim());
    }
    if (updates.description !== undefined) {
      fieldsToUpdate.push('description = ?');
      params.push(updates.description.trim());
    }
    if (updates.targetIndustries !== undefined) {
      fieldsToUpdate.push('target_industries = ?');
      params.push(JSON.stringify(updates.targetIndustries));
    }
    if (updates.companySizeRanges !== undefined) {
      fieldsToUpdate.push('company_size_ranges = ?');
      params.push(JSON.stringify(updates.companySizeRanges));
    }
    if (updates.targetLocations !== undefined) {
      fieldsToUpdate.push('target_locations = ?');
      params.push(JSON.stringify(updates.targetLocations));
    }
    if (updates.revenueRanges !== undefined) {
      fieldsToUpdate.push('revenue_ranges = ?');
      params.push(JSON.stringify(updates.revenueRanges));
    }
    if (updates.targetRoles !== undefined) {
      fieldsToUpdate.push('target_roles = ?');
      params.push(JSON.stringify(updates.targetRoles));
    }
    if (updates.seniorityLevels !== undefined) {
      fieldsToUpdate.push('seniority_levels = ?');
      params.push(JSON.stringify(updates.seniorityLevels));
    }
    if (updates.buyingTriggers !== undefined) {
      fieldsToUpdate.push('buying_triggers = ?');
      params.push(JSON.stringify(updates.buyingTriggers));
    }
    if (updates.techStack !== undefined) {
      fieldsToUpdate.push('tech_stack = ?');
      params.push(JSON.stringify(updates.techStack));
    }
    if (updates.minScoreThreshold !== undefined) {
      fieldsToUpdate.push('min_score_threshold = ?');
      params.push(updates.minScoreThreshold);
    }
    if (updates.negativeKeywords !== undefined) {
      fieldsToUpdate.push('negative_keywords = ?');
      params.push(JSON.stringify(updates.negativeKeywords));
    }

    const updateTx = db.transaction(() => {
      if (updates.isActive === true) {
        // Enforce single active profile transaction constraint
        db.prepare('UPDATE icp_profiles SET is_active = 0 WHERE id != ?').run(id);
        fieldsToUpdate.push('is_active = 1');
      } else if (updates.isActive === false) {
        fieldsToUpdate.push('is_active = 0');
      }

      params.push(id);
      db.prepare(`UPDATE icp_profiles SET ${fieldsToUpdate.join(', ')} WHERE id = ?`).run(...params);
    });

    updateTx();

    if (updates.isActive === true && existing.is_active === 0) {
      activityService.log(
        'score',
        'ICP Profile Activated',
        `Switched active ICP scoring rule to "${updates.name || existing.name}"`,
        'Active ICP'
      );
    }

    const updated = this.getById(id);
    if (!updated) {
      throw new Error('Failed to retrieve updated ICP profile');
    }
    return updated;
  },

  delete(id: string): boolean {
    const db = getDb();
    const existing = db.prepare('SELECT id, is_active FROM icp_profiles WHERE id = ?').get(id) as IcpProfileEntity | undefined;
    if (!existing) {
      return false;
    }

    const totalProfiles = (db.prepare('SELECT COUNT(*) as count FROM icp_profiles').get() as { count: number }).count;
    if (totalProfiles <= 1) {
      throw new Error('Cannot delete the last remaining ICP profile.');
    }

    const deleteTx = db.transaction(() => {
      db.prepare('DELETE FROM icp_profiles WHERE id = ?').run(id);

      // If we deleted the active one, make the most recent remaining profile active
      if (existing.is_active === 1) {
        const nextActive = db.prepare('SELECT id FROM icp_profiles ORDER BY updated_at DESC LIMIT 1').get() as { id: string } | undefined;
        if (nextActive) {
          db.prepare('UPDATE icp_profiles SET is_active = 1 WHERE id = ?').run(nextActive.id);
        }
      }
    });

    deleteTx();
    return true;
  },
};

