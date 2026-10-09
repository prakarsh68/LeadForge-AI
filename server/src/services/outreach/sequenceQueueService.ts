import { getDb } from '../../db/database.js';
import type {
  OutreachSequenceDTO,
  OutreachMessageDTO,
  OutreachCampaignDTO,
  LeadDTO,
} from '../../types/index.js';
import {
  outreachSequenceEntityToDto,
  outreachMessageEntityToDto,
  outreachCampaignEntityToDto,
  leadEntityToDto,
} from '../../utils/serializers.js';
import { getEmailProvider } from './emailProvider.js';
import { engagementService } from './engagementService.js';
import type { GeneratedEmailStep } from './emailGeneratorService.js';

export class SequenceQueueService {
  private workerInterval: NodeJS.Timeout | null = null;
  private workerId: string = `worker-${Math.random().toString(36).substring(2, 8)}`;
  private isProcessing: boolean = false;

  startWorker(intervalMs: number = 3000): void {
    if (this.workerInterval) return;
    this.workerInterval = setInterval(() => {
      this.processScheduledSequences().catch((err) => {
        console.error('[SequenceWorker] Error processing scheduled sequences:', err);
      });
    }, intervalMs);
  }

  stopWorker(): void {
    if (this.workerInterval) {
      clearInterval(this.workerInterval);
      this.workerInterval = null;
    }
  }

  createSequence(
    leadId: string,
    campaignId?: string | null,
    steps?: GeneratedEmailStep[]
  ): OutreachSequenceDTO {
    const db = getDb();
    const sequenceId = `seq-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO outreach_sequences (
        id, campaign_id, lead_id, status, current_step, max_steps,
        created_at, updated_at
      ) VALUES (?, ?, ?, 'draft', 1, 3, ?, ?)
    `).run(sequenceId, campaignId || null, leadId, now, now);

    if (steps && steps.length > 0) {
      const insertMsg = db.prepare(`
        INSERT INTO outreach_messages (
          id, sequence_id, step_number, subject, body_html, body_text,
          personalization_evidence, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
      `);

      for (const s of steps) {
        const msgId = `msg-${sequenceId}-step-${s.stepNumber}`;
        insertMsg.run(
          msgId,
          sequenceId,
          s.stepNumber,
          s.subject,
          s.bodyHtml,
          s.bodyText,
          JSON.stringify(s.personalizationEvidence || []),
          now,
          now
        );
      }
    }

    return this.getSequenceById(sequenceId)!;
  }

  getSequenceById(sequenceId: string): OutreachSequenceDTO | null {
    const db = getDb();
    const seqRow = db.prepare('SELECT * FROM outreach_sequences WHERE id = ?').get(sequenceId) as any;
    if (!seqRow) return null;

    const msgRows = db
      .prepare('SELECT * FROM outreach_messages WHERE sequence_id = ? ORDER BY step_number ASC')
      .all(sequenceId) as any[];
    const messages: OutreachMessageDTO[] = msgRows.map((m) => outreachMessageEntityToDto(m));

    let leadDto: LeadDTO | undefined;
    const leadRow = db.prepare('SELECT * FROM leads WHERE id = ?').get(seqRow.lead_id) as any;
    if (leadRow) {
      leadDto = leadEntityToDto(leadRow);
    }

    let campaignDto: OutreachCampaignDTO | undefined;
    if (seqRow.campaign_id) {
      const campRow = db.prepare('SELECT * FROM outreach_campaigns WHERE id = ?').get(seqRow.campaign_id) as any;
      if (campRow) {
        campaignDto = outreachCampaignEntityToDto(campRow);
      }
    }

    return outreachSequenceEntityToDto(seqRow, messages, leadDto, campaignDto);
  }

  listSequences(filter?: { campaignId?: string; leadId?: string; status?: string }): OutreachSequenceDTO[] {
    const db = getDb();
    let query = 'SELECT * FROM outreach_sequences WHERE 1=1';
    const params: any[] = [];

    if (filter?.campaignId) {
      query += ' AND campaign_id = ?';
      params.push(filter.campaignId);
    }
    if (filter?.leadId) {
      query += ' AND lead_id = ?';
      params.push(filter.leadId);
    }
    if (filter?.status) {
      query += ' AND status = ?';
      params.push(filter.status);
    }

    query += ' ORDER BY created_at DESC';
    const rows = db.prepare(query).all(...params) as any[];

    return rows.map((r) => this.getSequenceById(r.id)!);
  }

  approveSequence(sequenceId: string, approvedBy: string = 'system_user'): OutreachSequenceDTO {
    const db = getDb();
    const now = new Date().toISOString();

    const seq = db.prepare('SELECT * FROM outreach_sequences WHERE id = ?').get(sequenceId) as any;
    if (!seq) {
      throw new Error(`Sequence not found: ${sequenceId}`);
    }

    // Set sequence to approved and schedule step 1 immediately
    db.prepare(`
      UPDATE outreach_sequences
      SET status = 'approved', approved_at = ?, approved_by = ?, next_scheduled_at = ?, updated_at = ?
      WHERE id = ?
    `).run(now, approvedBy, now, now, sequenceId);

    // Update message step 1 to approved
    db.prepare(`
      UPDATE outreach_messages
      SET status = 'approved', updated_at = ?
      WHERE sequence_id = ? AND step_number = 1
    `).run(now, sequenceId);

    return this.getSequenceById(sequenceId)!;
  }

  pauseSequence(sequenceId: string): OutreachSequenceDTO {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE outreach_sequences
      SET status = 'paused', updated_at = ?
      WHERE id = ? AND status IN ('approved', 'scheduled', 'active')
    `).run(now, sequenceId);

    return this.getSequenceById(sequenceId)!;
  }

  resumeSequence(sequenceId: string): OutreachSequenceDTO {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE outreach_sequences
      SET status = 'approved', next_scheduled_at = ?, updated_at = ?
      WHERE id = ? AND status = 'paused'
    `).run(now, now, sequenceId);

    return this.getSequenceById(sequenceId)!;
  }

  cancelSequence(sequenceId: string, reason: string = 'User cancelled'): OutreachSequenceDTO {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE outreach_sequences
      SET status = 'cancelled', stop_reason = ?, updated_at = ?
      WHERE id = ?
    `).run(reason, now, sequenceId);

    return this.getSequenceById(sequenceId)!;
  }

  updateMessage(
    sequenceId: string,
    stepNumber: number,
    data: { subject?: string; bodyHtml?: string; bodyText?: string }
  ): OutreachMessageDTO {
    const db = getDb();
    const now = new Date().toISOString();

    const existing = db
      .prepare('SELECT * FROM outreach_messages WHERE sequence_id = ? AND step_number = ?')
      .get(sequenceId, stepNumber) as any;
    if (!existing) {
      throw new Error(`Message step ${stepNumber} not found for sequence ${sequenceId}`);
    }

    const updatedSubject = data.subject !== undefined ? data.subject : existing.subject;
    const updatedHtml = data.bodyHtml !== undefined ? data.bodyHtml : existing.body_html;
    const updatedText = data.bodyText !== undefined ? data.bodyText : existing.body_text;

    db.prepare(`
      UPDATE outreach_messages
      SET subject = ?, body_html = ?, body_text = ?, updated_at = ?
      WHERE sequence_id = ? AND step_number = ?
    `).run(updatedSubject, updatedHtml, updatedText, now, sequenceId, stepNumber);

    const row = db
      .prepare('SELECT * FROM outreach_messages WHERE sequence_id = ? AND step_number = ?')
      .get(sequenceId, stepNumber) as any;
    return outreachMessageEntityToDto(row);
  }

  async sendNextStep(sequenceId: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const db = getDb();
    const seq = db.prepare('SELECT * FROM outreach_sequences WHERE id = ?').get(sequenceId) as any;
    if (!seq) return { success: false, error: 'Sequence not found' };

    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(seq.lead_id) as any;
    if (!lead) return { success: false, error: 'Lead not found' };

    // 0. Email validation check
    if (!lead.email || typeof lead.email !== 'string' || !lead.email.trim()) {
      return { success: false, error: `Lead '${lead.name || 'Unknown'}' does not have a valid email address.` };
    }

    // 1. Safety Re-validation: Check suppression list
    if (engagementService.isSuppressed(lead.email)) {
      db.prepare(`
        UPDATE outreach_sequences
        SET status = 'stopped_on_opt_out', stop_reason = 'Email is in suppression list', updated_at = datetime('now')
        WHERE id = ?
      `).run(sequenceId);
      return { success: false, error: 'Email is suppressed. Sequence stopped.' };
    }

    // 2. Safety Re-validation: Check lead status
    if (lead.status === 'Disqualified' || lead.status === 'Won') {
      db.prepare(`
        UPDATE outreach_sequences
        SET status = 'cancelled', stop_reason = 'Lead already closed or disqualified', updated_at = datetime('now')
        WHERE id = ?
      `).run(sequenceId);
      return { success: false, error: `Lead status is ${lead.status}. Sequence stopped.` };
    }

    // 2b. Check if already completed
    if (seq.status === 'completed') {
      return { success: false, error: 'Sequence is already completed. All steps have been dispatched.' };
    }

    // 2c. Auto-activate if still in draft
    if (seq.status === 'draft') {
      const draftTime = new Date().toISOString();
      db.prepare(`
        UPDATE outreach_sequences
        SET status = 'active', approved_at = ?, approved_by = 'sales_operator', updated_at = ?
        WHERE id = ?
      `).run(draftTime, draftTime, sequenceId);
    }

    // 3. Find current step message
    const msg = db
      .prepare('SELECT * FROM outreach_messages WHERE sequence_id = ? AND step_number = ?')
      .get(sequenceId, seq.current_step) as any;

    if (!msg) {
      // All steps sent
      db.prepare(`
        UPDATE outreach_sequences
        SET status = 'completed', updated_at = datetime('now')
        WHERE id = ?
      `).run(sequenceId);
      return { success: true };
    }

    // Mark message as sending
    db.prepare("UPDATE outreach_messages SET status = 'sending', attempt_count = attempt_count + 1 WHERE id = ?").run(msg.id);

    // 4. Dispatch email via provider
    const provider = getEmailProvider();
    const sendResult = await provider.sendEmail({
      to: lead.email,
      subject: msg.subject,
      html: msg.body_html,
      text: msg.body_text,
      tags: { sequenceId, stepNumber: String(seq.current_step), leadId: lead.id },
      idempotencyKey: `leadforge-${sequenceId}-${seq.current_step}`,
    });

    const now = new Date().toISOString();

    if (!sendResult.success) {
      db.prepare(`
        UPDATE outreach_messages
        SET status = 'failed', error_message = ?, updated_at = ?
        WHERE id = ?
      `).run(sendResult.error || 'Failed to dispatch email', now, msg.id);

      db.prepare(`
        UPDATE outreach_sequences
        SET status = 'failed', stop_reason = ?, updated_at = ?
        WHERE id = ?
      `).run(sendResult.error || 'Send failure', now, sequenceId);

      return { success: false, error: sendResult.error };
    }

    // 5. Success: update message
    db.prepare(`
      UPDATE outreach_messages
      SET status = 'sent', provider_message_id = ?, sent_at = ?, updated_at = ?
      WHERE id = ?
    `).run(sendResult.providerMessageId || null, now, now, msg.id);

    // Advance lead status to Contacted if New or Qualified
    db.prepare(`
      UPDATE leads
      SET status = 'Contacted', updated_at = ?
      WHERE id = ? AND status IN ('New', 'Qualified')
    `).run(now, lead.id);

    // Record engagement event
    await engagementService.recordEvent({
      leadId: lead.id,
      sequenceId,
      messageId: msg.id,
      campaignId: seq.campaign_id,
      eventType: 'sent',
      providerEventId: sendResult.providerMessageId || `sent-${msg.id}`,
      sourceMetadata: { isSimulated: sendResult.isSimulated, step: seq.current_step },
      eventTimestamp: now,
    });

    // 6. Advance sequence to next step or complete
    if (seq.current_step >= seq.max_steps) {
      db.prepare(`
        UPDATE outreach_sequences
        SET status = 'completed', next_scheduled_at = NULL, updated_at = ?
        WHERE id = ?
      `).run(now, sequenceId);
    } else {
      const nextStep = seq.current_step + 1;
      // In test or quick dev mode, 3 minutes delay; in standard mode, 3 days
      const isTestEnv = process.env.NODE_ENV === 'test';
      const delayDays = nextStep === 2 ? 3 : 5;
      const nextScheduled = new Date(Date.now() + (isTestEnv ? 1000 * 60 : delayDays * 24 * 60 * 60 * 1000)).toISOString();

      db.prepare(`
        UPDATE outreach_sequences
        SET current_step = ?, status = 'active', next_scheduled_at = ?, updated_at = ?
        WHERE id = ?
      `).run(nextStep, nextScheduled, now, sequenceId);

      // Mark next message as scheduled
      db.prepare(`
        UPDATE outreach_messages
        SET status = 'scheduled', scheduled_at = ?, updated_at = ?
        WHERE sequence_id = ? AND step_number = ?
      `).run(nextScheduled, now, sequenceId, nextStep);
    }

    return { success: true, messageId: sendResult.providerMessageId };
  }

  async processScheduledSequences(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const db = getDb();

      // Find sequences ready to send with expired or absent leases
      const candidateRows = db
        .prepare(`
          SELECT id FROM outreach_sequences
          WHERE status IN ('approved', 'active', 'scheduled')
            AND (next_scheduled_at IS NULL OR next_scheduled_at <= datetime('now'))
            AND (lease_expires_at IS NULL OR lease_expires_at < datetime('now'))
          LIMIT 5
        `)
        .all() as Array<{ id: string }>;

      for (const row of candidateRows) {
        // Atomic lease claim
        const leaseExpires = new Date(Date.now() + 60000).toISOString();
        const updateResult = db
          .prepare(`
            UPDATE outreach_sequences
            SET claimed_by = ?, lease_expires_at = ?
            WHERE id = ? AND (lease_expires_at IS NULL OR lease_expires_at < datetime('now'))
          `)
          .run(this.workerId, leaseExpires, row.id);

        if (updateResult.changes > 0) {
          try {
            await this.sendNextStep(row.id);
          } finally {
            // Release lease
            db.prepare('UPDATE outreach_sequences SET lease_expires_at = NULL, claimed_by = NULL WHERE id = ?').run(row.id);
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
}

export const sequenceQueueService = new SequenceQueueService();

