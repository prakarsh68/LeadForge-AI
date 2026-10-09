import { getDb } from '../db/database.js';
import type { ActivityEntity, ActivityDTO } from '../types/index.js';
import { activityEntityToDto } from '../utils/serializers.js';
import { ALLOWED_ACTIVITY_TYPES } from '../utils/validators.js';

export interface CreateActivityInput {
  type: 'discovery' | 'score' | 'outreach' | 'stage_change';
  title: string;
  description: string;
  badge?: string;
  timestamp?: string;
}

export const activityService = {
  getAll(options: { limit?: number; type?: string } = {}): { items: ActivityDTO[]; total: number } {
    const db = getDb();
    const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);

    const conditions: string[] = [];
    const params: any[] = [];

    if (options.type && ALLOWED_ACTIVITY_TYPES.includes(options.type as any)) {
      conditions.push('type = ?');
      params.push(options.type);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countStmt = db.prepare(`SELECT COUNT(*) as count FROM activities ${whereClause}`);
    const total = (countStmt.get(...params) as { count: number }).count;

    const queryStmt = db.prepare(`
      SELECT * FROM activities
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ?
    `);

    const rows = queryStmt.all(...params, limit) as ActivityEntity[];
    return {
      items: rows.map(activityEntityToDto),
      total,
    };
  },

  create(data: CreateActivityInput): ActivityDTO {
    const db = getDb();
    const id = `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = data.timestamp || 'Just now';

    const insertStmt = db.prepare(`
      INSERT INTO activities (id, type, title, description, timestamp, badge, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    insertStmt.run(id, data.type, data.title, data.description, timestamp, data.badge || null);

    const created = db.prepare('SELECT * FROM activities WHERE id = ?').get(id) as ActivityEntity;
    return activityEntityToDto(created);
  },

  log(type: 'discovery' | 'score' | 'outreach' | 'stage_change', title: string, description: string, badge?: string): ActivityDTO {
    return this.create({ type, title, description, badge });
  },
};

