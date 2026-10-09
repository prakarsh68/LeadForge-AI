import { getDb } from '../../db/database.js';
import type {
  OutreachCampaignDTO,
  CampaignStatus,
} from '../../types/index.js';
import { outreachCampaignEntityToDto } from '../../utils/serializers.js';

export const campaignService = {
  listCampaigns(): OutreachCampaignDTO[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM outreach_campaigns ORDER BY created_at DESC').all() as any[];
    return rows.map((r) => {
      const stats = this.getCampaignStats(r.id);
      return outreachCampaignEntityToDto(r, stats);
    });
  },

  getCampaignById(id: string): OutreachCampaignDTO | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM outreach_campaigns WHERE id = ?').get(id) as any;
    if (!row) return null;
    const stats = this.getCampaignStats(id);
    return outreachCampaignEntityToDto(row, stats);
  },

  createCampaign(data: {
    name: string;
    description?: string;
    targetIcpId?: string | null;
    status?: CampaignStatus;
    sendingLimits?: { maxPerDay: number; minIntervalSeconds: number };
    scheduleWindow?: { timezone: string; allowedDays: number[]; startHour: number; endHour: number };
  }): OutreachCampaignDTO {
    const db = getDb();
    const id = `camp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO outreach_campaigns (
        id, name, description, target_icp_id, status, sending_limits,
        schedule_window, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name,
      data.description || '',
      data.targetIcpId || null,
      data.status || 'draft',
      JSON.stringify(data.sendingLimits || { maxPerDay: 50, minIntervalSeconds: 60 }),
      JSON.stringify(
        data.scheduleWindow || { timezone: 'UTC', allowedDays: [1, 2, 3, 4, 5], startHour: 9, endHour: 17 }
      ),
      now,
      now
    );

    return this.getCampaignById(id)!;
  },

  updateCampaign(
    id: string,
    data: {
      name?: string;
      description?: string;
      targetIcpId?: string | null;
      status?: CampaignStatus;
      sendingLimits?: { maxPerDay: number; minIntervalSeconds: number };
      scheduleWindow?: { timezone: string; allowedDays: number[]; startHour: number; endHour: number };
    }
  ): OutreachCampaignDTO {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM outreach_campaigns WHERE id = ?').get(id) as any;
    if (!existing) {
      throw new Error(`Campaign not found: ${id}`);
    }

    const now = new Date().toISOString();
    const name = data.name !== undefined ? data.name : existing.name;
    const description = data.description !== undefined ? data.description : existing.description;
    const targetIcpId = data.targetIcpId !== undefined ? data.targetIcpId : existing.target_icp_id;
    const status = data.status !== undefined ? data.status : existing.status;
    const sendingLimits =
      data.sendingLimits !== undefined
        ? JSON.stringify(data.sendingLimits)
        : existing.sending_limits;
    const scheduleWindow =
      data.scheduleWindow !== undefined
        ? JSON.stringify(data.scheduleWindow)
        : existing.schedule_window;

    db.prepare(`
      UPDATE outreach_campaigns
      SET name = ?, description = ?, target_icp_id = ?, status = ?,
          sending_limits = ?, schedule_window = ?, updated_at = ?
      WHERE id = ?
    `).run(name, description, targetIcpId, status, sendingLimits, scheduleWindow, now, id);

    return this.getCampaignById(id)!;
  },

  deleteCampaign(id: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM outreach_campaigns WHERE id = ?').run(id);
    return result.changes > 0;
  },

  getCampaignStats(campaignId: string): {
    totalSequences: number;
    activeSequences: number;
    sentCount: number;
    replyCount: number;
    meetingCount: number;
    replyRate: number;
  } {
    const db = getDb();
    const totalSequences = (
      db.prepare('SELECT COUNT(*) as c FROM outreach_sequences WHERE campaign_id = ?').get(campaignId) as any
    ).c;
    const activeSequences = (
      db.prepare("SELECT COUNT(*) as c FROM outreach_sequences WHERE campaign_id = ? AND status IN ('active', 'approved', 'scheduled')").get(campaignId) as any
    ).c;
    const sentCount = (
      db.prepare("SELECT COUNT(*) as c FROM engagement_events WHERE campaign_id = ? AND event_type = 'sent'").get(campaignId) as any
    ).c;
    const replyCount = (
      db.prepare("SELECT COUNT(*) as c FROM engagement_events WHERE campaign_id = ? AND event_type = 'replied'").get(campaignId) as any
    ).c;
    const meetingCount = (
      db.prepare("SELECT COUNT(*) as c FROM engagement_events WHERE campaign_id = ? AND event_type = 'meeting_booked'").get(campaignId) as any
    ).c;
    const replyRate = sentCount > 0 ? Math.round((replyCount / sentCount) * 1000) / 10 : 0;

    return {
      totalSequences,
      activeSequences,
      sentCount,
      replyCount,
      meetingCount,
      replyRate,
    };
  },
};

