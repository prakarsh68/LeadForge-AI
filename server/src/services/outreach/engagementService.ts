import { getDb } from '../../db/database.js';
import type {
  EngagementEventDTO,
  EngagementEventType,
  SuppressionReason,
  SuppressionDTO,
} from '../../types/index.js';
import { engagementEventEntityToDto, suppressionEntityToDto } from '../../utils/serializers.js';

export interface IngestEventOptions {
  leadId: string;
  sequenceId?: string | null;
  messageId?: string | null;
  campaignId?: string | null;
  eventType: EngagementEventType;
  providerEventId?: string | null;
  sourceMetadata?: Record<string, any>;
  eventTimestamp?: string;
}

export const engagementService = {
  isSuppressed(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    const db = getDb();
    const cleanEmail = email.trim().toLowerCase();
    const row = db.prepare('SELECT id FROM suppression_list WHERE email = ?').get(cleanEmail);
    return Boolean(row);
  },

  addToSuppressionList(email: string, reason: SuppressionReason, source: string = 'system'): SuppressionDTO {
    if (!email || typeof email !== 'string') {
      throw new Error('Valid email address is required');
    }
    const db = getDb();
    const cleanEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT * FROM suppression_list WHERE email = ?').get(cleanEmail) as any;
    if (existing) {
      return suppressionEntityToDto(existing);
    }

    const id = `sup-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO suppression_list (id, email, reason, source, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, cleanEmail, reason, source, now);

    return {
      id,
      email: cleanEmail,
      reason,
      source,
      createdAt: now,
    };
  },

  getSuppressionList(): SuppressionDTO[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM suppression_list ORDER BY created_at DESC').all() as any[];
    return rows.map((r) => suppressionEntityToDto(r));
  },

  removeFromSuppressionList(id: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM suppression_list WHERE id = ?').run(id);
    return result.changes > 0;
  },

  async recordEvent(options: IngestEventOptions): Promise<{ event: EngagementEventDTO; isDuplicate: boolean }> {
    const db = getDb();
    const now = options.eventTimestamp || new Date().toISOString();

    // 1. Deduplication check
    if (options.providerEventId) {
      const existing = db
        .prepare('SELECT * FROM engagement_events WHERE provider_event_id = ?')
        .get(options.providerEventId) as any;
      if (existing) {
        return {
          event: engagementEventEntityToDto(existing),
          isDuplicate: true,
        };
      }
    }

    const eventId = `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // 2. Insert event
    db.prepare(`
      INSERT INTO engagement_events (
        id, lead_id, sequence_id, message_id, campaign_id,
        event_type, event_timestamp, provider_event_id, source_metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      eventId,
      options.leadId,
      options.sequenceId || null,
      options.messageId || null,
      options.campaignId || null,
      options.eventType,
      now,
      options.providerEventId || null,
      JSON.stringify(options.sourceMetadata || {}),
      now
    );

    // 3. Process Lifecycle Transitions & Guardrails
    this.processLifecycleProgression(options);

    const savedEvent = db.prepare('SELECT * FROM engagement_events WHERE id = ?').get(eventId) as any;
    return {
      event: engagementEventEntityToDto(savedEvent),
      isDuplicate: false,
    };
  },

  processLifecycleProgression(options: IngestEventOptions): void {
    const db = getDb();
    const now = new Date().toISOString();

    const lead = db.prepare('SELECT id, name, company, email, status FROM leads WHERE id = ?').get(options.leadId) as any;
    if (!lead) return;

    switch (options.eventType) {
      case 'sent': {
        // Advance lead status from New -> Contacted
        if (lead.status === 'New') {
          db.prepare("UPDATE leads SET status = 'Contacted', last_active = 'Just now', updated_at = ? WHERE id = ?").run(now, lead.id);
        }
        break;
      }

      case 'replied': {
        // Stop sequence on reply
        if (options.sequenceId) {
          db.prepare(`
            UPDATE outreach_sequences
            SET status = 'stopped_on_reply', stop_reason = 'Lead replied to outreach', updated_at = ?
            WHERE id = ? AND status IN ('approved', 'scheduled', 'active', 'pending_approval')
          `).run(now, options.sequenceId);
        }

        // Advance lead status to Qualified
        db.prepare("UPDATE leads SET status = 'Qualified', last_active = 'Replied just now', updated_at = ? WHERE id = ?").run(now, lead.id);

        // Update corresponding opportunity if present
        db.prepare("UPDATE opportunities SET stage = 'Qualified', updated_at = ? WHERE lead_id = ?").run(now, lead.id);

        // Record activity
        this.recordActivity(
          'outreach',
          'Lead Replied to Outreach',
          `${lead.name} (${lead.company}) replied to outbound campaign. Sequence automatically concluded.`,
          'Replied'
        );
        break;
      }

      case 'bounced': {
        // Suppress email
        if (lead.email) {
          this.addToSuppressionList(lead.email, 'bounced', 'outreach_delivery');
        }

        // Stop sequence
        if (options.sequenceId) {
          db.prepare(`
            UPDATE outreach_sequences
            SET status = 'failed', stop_reason = 'Email bounced', updated_at = ?
            WHERE id = ?
          `).run(now, options.sequenceId);
        }

        if (options.messageId) {
          db.prepare("UPDATE outreach_messages SET status = 'bounced', updated_at = ? WHERE id = ?").run(now, options.messageId);
        }
        break;
      }

      case 'unsubscribed': {
        // Suppress email
        if (lead.email) {
          this.addToSuppressionList(lead.email, 'unsubscribed', 'opt_out');
        }

        // Stop sequence immediately
        if (options.sequenceId) {
          db.prepare(`
            UPDATE outreach_sequences
            SET status = 'stopped_on_opt_out', stop_reason = 'Recipient unsubscribed', updated_at = ?
            WHERE id = ?
          `).run(now, options.sequenceId);
        }

        // Update lead status
        db.prepare("UPDATE leads SET status = 'Disqualified', updated_at = ? WHERE id = ?").run(now, lead.id);

        this.recordActivity(
          'stage_change',
          'Lead Opted Out',
          `${lead.name} (${lead.company}) requested opt-out and was added to the suppression list.`,
          'Opted Out'
        );
        break;
      }

      case 'meeting_booked': {
        // Stop sequence if ongoing
        if (options.sequenceId) {
          db.prepare(`
            UPDATE outreach_sequences
            SET status = 'completed', stop_reason = 'Meeting booked successfully', updated_at = ?
            WHERE id = ? AND status IN ('approved', 'scheduled', 'active')
          `).run(now, options.sequenceId);
        }

        // Advance lead to Proposal
        db.prepare("UPDATE leads SET status = 'Proposal', last_active = 'Meeting booked', updated_at = ? WHERE id = ?").run(now, lead.id);
        db.prepare("UPDATE opportunities SET stage = 'Proposal', confidence_score = MIN(98, confidence_score + 25), updated_at = ? WHERE lead_id = ?").run(now, lead.id);

        this.recordActivity(
          'stage_change',
          'Demo / Meeting Scheduled',
          `${lead.name} (${lead.company}) booked a product demonstration. Stage advanced to Proposal.`,
          'Meeting Booked'
        );
        break;
      }
    }
  },

  recordActivity(type: 'outreach' | 'stage_change' | 'score' | 'discovery', title: string, description: string, badge?: string): void {
    const db = getDb();
    const id = `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    try {
      db.prepare(`
        INSERT INTO activities (id, type, title, description, timestamp, badge, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, type, title, description, 'Just now', badge || null, now);
    } catch {
      // Non-critical logging fallback
    }
  },

  getEventsForLead(leadId: string): EngagementEventDTO[] {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM engagement_events WHERE lead_id = ? ORDER BY event_timestamp DESC')
      .all(leadId) as any[];
    return rows.map((r) => engagementEventEntityToDto(r));
  },
};

