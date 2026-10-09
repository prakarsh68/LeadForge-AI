import { leadService } from '../leadService.js';
import { emailGeneratorService } from './emailGeneratorService.js';
import { sequenceQueueService } from './sequenceQueueService.js';
import { engagementService } from './engagementService.js';
import { crmService, type CrmSyncResult } from '../crm/crmService.js';
import { activityService } from '../activityService.js';
import type {
  OutreachSequenceDTO,
  CrmSyncRecordDTO,
} from '../../types/index.js';

export interface AgenticSendOptions {
  leadId?: string;
  sequenceId?: string;
  campaignId?: string;
  customInstructions?: string;
  autoSyncCrm?: boolean;
}

export interface AgenticSendTraceStep {
  phase: string;
  name: string;
  status: 'pending' | 'success' | 'failed' | 'skipped';
  detail: string;
  timestamp: string;
}

export interface AgenticSendResult {
  success: boolean;
  sequence?: OutreachSequenceDTO;
  messageId?: string;
  stepNumber?: number;
  recipientEmail?: string;
  emailSubject?: string;
  emailPreview?: string;
  crmRecord?: CrmSyncRecordDTO;
  trace: AgenticSendTraceStep[];
  error?: string;
}

export class AgenticOutreachService {
  /**
   * Executes autonomous, evidence-grounded agentic outreach for a lead or sequence.
   * Performs safety checks, synthesis/refinement, provider dispatch, and CRM sync.
   */
  async executeAgenticSend(options: AgenticSendOptions): Promise<AgenticSendResult> {
    const trace: AgenticSendTraceStep[] = [];
    const addTrace = (
      phase: string,
      name: string,
      status: 'pending' | 'success' | 'failed' | 'skipped',
      detail: string
    ) => {
      trace.push({
        phase,
        name,
        status,
        detail,
        timestamp: new Date().toISOString(),
      });
    };

    // 1. Resolve Target Lead & Sequence
    let targetLeadId = options.leadId;
    let sequence: OutreachSequenceDTO | null = null;

    if (options.sequenceId) {
      sequence = sequenceQueueService.getSequenceById(options.sequenceId);
      if (!sequence) {
        addTrace('target_resolution', 'Sequence Resolution', 'failed', `Sequence '${options.sequenceId}' not found.`);
        return {
          success: false,
          error: `Sequence '${options.sequenceId}' not found.`,
          trace,
        };
      }
      targetLeadId = sequence.leadId;
    }

    if (!targetLeadId) {
      addTrace('target_resolution', 'Target Validation', 'failed', 'Missing target leadId or sequenceId.');
      return {
        success: false,
        error: 'Either leadId or sequenceId is required to execute agentic outreach.',
        trace,
      };
    }

    const lead = leadService.getById(targetLeadId);
    if (!lead) {
      addTrace('target_resolution', 'Lead Profile Lookup', 'failed', `Lead '${targetLeadId}' does not exist.`);
      return {
        success: false,
        error: `Target lead '${targetLeadId}' not found in the database.`,
        trace,
      };
    }

    addTrace(
      'target_resolution',
      'Lead Profile Lookup',
      'success',
      `Target confirmed: ${lead.name} (${lead.title} at ${lead.company}). Tier: ${lead.tier.toUpperCase()}, Status: ${lead.status}.`
    );

    // 2. Deliverability & Compliance Verification
    if (!lead.email || typeof lead.email !== 'string' || !lead.email.trim()) {
      addTrace(
        'compliance_verification',
        'Email Address Validation',
        'failed',
        `Lead '${lead.name}' does not have a verified work email address.`
      );
      return {
        success: false,
        error: `Cannot send outreach: Prospect '${lead.name}' at ${lead.company} is missing a work email address. Please enrich contact details first.`,
        trace,
      };
    }

    if (engagementService.isSuppressed(lead.email)) {
      addTrace(
        'compliance_verification',
        'Suppression & Opt-Out Registry',
        'failed',
        `Email '${lead.email}' is actively listed in the suppression / do-not-contact registry.`
      );
      return {
        success: false,
        error: `Recipient email '${lead.email}' is on the suppression list. Outreach aborted to ensure strict CAN-SPAM / GDPR compliance.`,
        trace,
      };
    }

    if (lead.status === 'Disqualified') {
      addTrace(
        'compliance_verification',
        'Lifecycle Eligibility Check',
        'failed',
        `Lead '${lead.name}' is marked as Disqualified.`
      );
      return {
        success: false,
        error: `Cannot dispatch outreach to disqualified lead '${lead.name}'.`,
        trace,
      };
    }

    addTrace(
      'compliance_verification',
      'Compliance & Safety Guardrails',
      'success',
      `Deliverability validated: ${lead.email} is clean, unsuppressed, and eligible for outbound engagement.`
    );

    // 3. Grounding & Sequence Formulation
    if (!sequence) {
      const existingSequences = sequenceQueueService.listSequences({ leadId: lead.id });
      sequence = existingSequences.find((s) => s.status !== 'cancelled' && s.status !== 'completed') || null;
    }

    if (!sequence) {
      addTrace(
        'grounding_synthesis',
        'Knowledge Intelligence & Trigger Retrieval',
        'pending',
        `Retrieving buying triggers and knowledge base collateral for ${lead.company}...`
      );

      const generatedDraft = await emailGeneratorService.generateSequence(lead, {
        campaignName: 'Agentic Autonomous Outreach',
        customInstructions: options.customInstructions,
      });

      addTrace(
        'grounding_synthesis',
        'Grounded Sequence Synthesis',
        'success',
        `Generated 3-step sequence anchored in ${generatedDraft.evidenceUsed.length} evidence points (Mode: ${generatedDraft.generationMode}).`
      );

      sequence = sequenceQueueService.createSequence(
        lead.id,
        options.campaignId || null,
        generatedDraft.steps
      );
    } else if (!sequence.messages || sequence.messages.length === 0) {
      // Sequence exists but has no draft messages: synthesize and populate into existing sequence
      const generatedDraft = await emailGeneratorService.generateSequence(lead, {
        campaignName: 'Agentic Autonomous Outreach',
        customInstructions: options.customInstructions,
      });

      const db = (await import('../../db/database.js')).getDb();
      const insertMsg = db.prepare(`
        INSERT INTO outreach_messages (
          id, sequence_id, step_number, subject, body_html, body_text,
          personalization_evidence, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', datetime('now'), datetime('now'))
      `);

      for (const s of generatedDraft.steps) {
        insertMsg.run(
          `msg-${sequence.id}-step-${s.stepNumber}`,
          sequence.id,
          s.stepNumber,
          s.subject,
          s.bodyHtml,
          s.bodyText,
          JSON.stringify(s.personalizationEvidence || [])
        );
      }

      sequence = sequenceQueueService.getSequenceById(sequence.id)!;
      addTrace(
        'grounding_synthesis',
        'Grounded Sequence Synthesis',
        'success',
        `Generated and attached 3 evidence-grounded steps to sequence ${sequence.id}.`
      );
    } else {
      addTrace(
        'grounding_synthesis',
        'Active Sequence Retrieval',
        'success',
        `Using sequence ${sequence.id} (Current step: ${sequence.currentStep} of ${sequence.maxSteps}).`
      );
    }

    // 4. Governance & Auto-Approval Gate
    if (sequence.status === 'draft') {
      sequence = sequenceQueueService.approveSequence(sequence.id, 'agentic_model');
      addTrace(
        'governance_gate',
        'Autonomous Approval Gate',
        'success',
        'Sequence automatically approved and authorized by LeadForge Agentic Orchestrator.'
      );
    } else {
      addTrace(
        'governance_gate',
        'Governance Verification',
        'success',
        `Sequence is in state '${sequence.status}' (Authorized for dispatch).`
      );
    }

    // 5. Message Dispatch
    const currentStepNum = sequence.currentStep;
    const currentDraftMessage = sequence.messages?.find((m) => m.stepNumber === currentStepNum);

    addTrace(
      'message_dispatch',
      'Email Provider Dispatch',
      'pending',
      `Dispatching Step ${currentStepNum} ("${currentDraftMessage?.subject || 'Outreach'}") to ${lead.email}...`
    );

    const sendResult = await sequenceQueueService.sendNextStep(sequence.id);
    if (!sendResult.success) {
      addTrace(
        'message_dispatch',
        'Email Provider Dispatch',
        'failed',
        sendResult.error || 'Provider rejected transmission'
      );
      return {
        success: false,
        error: `Message dispatch failed: ${sendResult.error}`,
        trace,
      };
    }

    // Reload refreshed sequence
    const updatedSequence = sequenceQueueService.getSequenceById(sequence.id)!;
    const sentMessage = updatedSequence.messages?.find((m) => m.stepNumber === currentStepNum);

    addTrace(
      'message_dispatch',
      'Email Provider Dispatch',
      'success',
      `Dispatched Step ${currentStepNum} via provider. Provider Message ID: ${sendResult.messageId || 'simulated'}.`
    );

    // 6. CRM Synchronization (HubSpot)
    let crmSyncResult: CrmSyncResult | null = null;
    if (options.autoSyncCrm !== false) {
      try {
        crmSyncResult = await crmService.syncLead(lead.id);
        const contactId = crmSyncResult?.syncRecord?.externalContactId || 'Synced';
        addTrace(
          'crm_synchronization',
          'HubSpot CRM Sync',
          'success',
          `Synchronized contact, lifecycle status, and opportunity to HubSpot (External Contact ID: ${contactId}).`
        );
      } catch (crmErr: any) {
        addTrace(
          'crm_synchronization',
          'HubSpot CRM Sync',
          'failed',
          `Non-blocking CRM sync warning: ${crmErr.message || 'CRM integration error'}`
        );
      }
    } else {
      addTrace(
        'crm_synchronization',
        'HubSpot CRM Sync',
        'skipped',
        'CRM synchronization skipped per configuration.'
      );
    }

    // 7. Activity & Audit Trail
    activityService.create({
      type: 'outreach',
      title: `Agentic Dispatch: Step ${currentStepNum} to ${lead.name}`,
      description: `LeadForge AI Agent autonomously crafted, verified deliverability, and dispatched Step ${currentStepNum} to ${lead.name} (${lead.company}) via provider, advancing lifecycle and updating CRM.`,
      badge: 'Agentic Outreach',
    });

    addTrace(
      'audit_logging',
      'Audit Trail Recorded',
      'success',
      `Logged autonomous dispatch event in global Activity Stream.`
    );

    return {
      success: true,
      sequence: updatedSequence,
      messageId: sendResult.messageId,
      stepNumber: currentStepNum,
      recipientEmail: lead.email,
      emailSubject: sentMessage?.subject || currentDraftMessage?.subject || 'Outbound Outreach',
      emailPreview: sentMessage?.bodyText?.slice(0, 240) || currentDraftMessage?.bodyText?.slice(0, 240) || '',
      crmRecord: crmSyncResult?.syncRecord,
      trace,
    };
  }
}

export const agenticOutreachService = new AgenticOutreachService();
