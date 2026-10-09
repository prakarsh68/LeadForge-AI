import { getDb } from '../../db/database.js';
import type {
  CrmProvider,
  CrmStatusDTO,
  CrmSyncRecordDTO,
} from '../../types/index.js';
import { crmSyncRecordEntityToDto } from '../../utils/serializers.js';

export interface CrmSyncResult {
  success: boolean;
  syncRecord: CrmSyncRecordDTO;
  error?: string;
  isSimulated: boolean;
}

export interface ICrmConnector {
  syncLead(leadId: string): Promise<CrmSyncResult>;
  getStatus(): CrmStatusDTO;
}

export class HubSpotCrmConnector implements ICrmConnector {
  private accessToken: string | null;
  private providerName: CrmProvider = 'hubspot';

  constructor() {
    this.accessToken = process.env.HUBSPOT_ACCESS_TOKEN?.trim() || null;
  }

  getStatus(): CrmStatusDTO {
    const db = getDb();
    const isConfigured = Boolean(this.accessToken);
    const mode = isConfigured ? 'real' : 'demo';

    const synced = (
      db.prepare("SELECT COUNT(*) as c FROM crm_sync_records WHERE crm_provider = 'hubspot' AND sync_status = 'synced'").get() as any
    ).c;
    const pending = (
      db.prepare("SELECT COUNT(*) as c FROM crm_sync_records WHERE crm_provider = 'hubspot' AND sync_status = 'pending'").get() as any
    ).c;
    const failed = (
      db.prepare("SELECT COUNT(*) as c FROM crm_sync_records WHERE crm_provider = 'hubspot' AND sync_status = 'failed'").get() as any
    ).c;
    const lastRow = db
      .prepare("SELECT last_synced_at FROM crm_sync_records WHERE crm_provider = 'hubspot' AND sync_status = 'synced' ORDER BY last_synced_at DESC LIMIT 1")
      .get() as any;

    return {
      provider: 'hubspot',
      isConfigured,
      mode,
      totalSynced: synced,
      pendingSync: pending,
      failedSync: failed,
      lastSyncedAt: lastRow?.last_synced_at || null,
    };
  }

  async syncLead(leadId: string): Promise<CrmSyncResult> {
    const db = getDb();
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId) as any;
    if (!lead) {
      throw new Error(`Lead not found for CRM sync: ${leadId}`);
    }

    const opp = db.prepare('SELECT * FROM opportunities WHERE lead_id = ?').get(leadId) as any;
    const syncId = `crm-${leadId}-hubspot`;
    const now = new Date().toISOString();

    const nameParts = (lead.name || '').trim().split(' ');
    const firstName = nameParts[0] || 'Unknown';
    const lastName = nameParts.slice(1).join(' ') || 'Contact';

    const fieldMappings: Record<string, any> = {
      email: lead.email,
      firstname: firstName,
      lastname: lastName,
      jobtitle: lead.title,
      company: lead.company,
      hs_lead_status: lead.status === 'Won' ? 'CONNECTED' : lead.status === 'Qualified' ? 'OPEN' : 'NEW',
      lifecyclestage: lead.status === 'Won' ? 'customer' : lead.status === 'Proposal' ? 'opportunity' : 'lead',
      leadforge_icp_score: String(lead.score || 0),
      leadforge_tier: lead.tier || 'medium',
      leadforge_deal_value: String(lead.deal_value || 0),
    };

    // If no access token configured or in test mode, safely simulate
    if (!this.accessToken || process.env.NODE_ENV === 'test') {
      const externalContactId = `hs-contact-${Date.now().toString(36)}`;
      const externalCompanyId = `hs-company-${lead.company_domain.replace(/[^a-zA-Z0-9]/g, '')}`;
      const externalDealId = opp ? `hs-deal-${opp.id}` : null;

      db.prepare(`
        INSERT INTO crm_sync_records (
          id, lead_id, opportunity_id, crm_provider, external_contact_id,
          external_company_id, external_deal_id, sync_status, last_synced_at,
          retry_count, error_message, field_mappings, created_at, updated_at
        ) VALUES (?, ?, ?, 'hubspot', ?, ?, ?, 'synced', ?, 0, NULL, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          external_contact_id = excluded.external_contact_id,
          external_company_id = excluded.external_company_id,
          external_deal_id = excluded.external_deal_id,
          sync_status = 'synced',
          last_synced_at = excluded.last_synced_at,
          error_message = NULL,
          field_mappings = excluded.field_mappings,
          updated_at = excluded.updated_at
      `).run(
        syncId,
        leadId,
        opp?.id || null,
        externalContactId,
        externalCompanyId,
        externalDealId,
        now,
        JSON.stringify(fieldMappings),
        now,
        now
      );

      const saved = db.prepare('SELECT * FROM crm_sync_records WHERE id = ?').get(syncId) as any;
      return {
        success: true,
        syncRecord: crmSyncRecordEntityToDto(saved),
        isSimulated: true,
      };
    }

    // Real HubSpot API Integration
    try {
      // 1. Create or update contact
      let externalContactId: string | null = null;
      const contactRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: fieldMappings,
        }),
      });

      if (contactRes.status === 409) {
        // Conflict: Contact already exists. Search and update.
        const searchRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filterGroups: [
              {
                filters: [{ propertyName: 'email', operator: 'EQ', value: lead.email }],
              },
            ],
          }),
        });

        if (searchRes.ok) {
          const searchData = (await searchRes.json()) as any;
          if (searchData.results && searchData.results.length > 0) {
            externalContactId = searchData.results[0].id;
            // Update contact
            await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${externalContactId}`, {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ properties: fieldMappings }),
            });
          }
        }
      } else if (!contactRes.ok) {
        const errorText = await contactRes.text();
        throw new Error(`HubSpot Contact API HTTP ${contactRes.status}: ${errorText.substring(0, 300)}`);
      } else {
        const contactData = (await contactRes.json()) as any;
        externalContactId = contactData.id;
      }

      // 2. Create Deal if opportunity exists
      let externalDealId: string | null = null;
      if (opp && externalContactId) {
        const dealRes = await fetch('https://api.hubapi.com/crm/v3/objects/deals', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            properties: {
              dealname: opp.title,
              amount: String(opp.deal_value || 0),
              dealstage: opp.stage === 'Won' ? 'closedwon' : 'appointmentscheduled',
              pipeline: 'default',
            },
          }),
        });

        if (dealRes.ok) {
          const dealData = (await dealRes.json()) as any;
          externalDealId = dealData.id;
        }
      }

      // Record success
      db.prepare(`
        INSERT INTO crm_sync_records (
          id, lead_id, opportunity_id, crm_provider, external_contact_id,
          external_company_id, external_deal_id, sync_status, last_synced_at,
          retry_count, error_message, field_mappings, created_at, updated_at
        ) VALUES (?, ?, ?, 'hubspot', ?, NULL, ?, 'synced', ?, 0, NULL, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          external_contact_id = excluded.external_contact_id,
          external_deal_id = excluded.external_deal_id,
          sync_status = 'synced',
          last_synced_at = excluded.last_synced_at,
          error_message = NULL,
          field_mappings = excluded.field_mappings,
          updated_at = excluded.updated_at
      `).run(
        syncId,
        leadId,
        opp?.id || null,
        externalContactId,
        externalDealId,
        now,
        JSON.stringify(fieldMappings),
        now,
        now
      );

      const saved = db.prepare('SELECT * FROM crm_sync_records WHERE id = ?').get(syncId) as any;
      return {
        success: true,
        syncRecord: crmSyncRecordEntityToDto(saved),
        isSimulated: false,
      };
    } catch (err: any) {
      const errorMsg = err.message || 'CRM sync error';
      db.prepare(`
        INSERT INTO crm_sync_records (
          id, lead_id, opportunity_id, crm_provider, sync_status,
          last_synced_at, retry_count, error_message, field_mappings, created_at, updated_at
        ) VALUES (?, ?, ?, 'hubspot', 'failed', ?, 1, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          sync_status = 'failed',
          retry_count = retry_count + 1,
          error_message = excluded.error_message,
          updated_at = excluded.updated_at
      `).run(
        syncId,
        leadId,
        opp?.id || null,
        now,
        errorMsg,
        JSON.stringify(fieldMappings),
        now,
        now
      );

      const saved = db.prepare('SELECT * FROM crm_sync_records WHERE id = ?').get(syncId) as any;
      return {
        success: false,
        syncRecord: crmSyncRecordEntityToDto(saved),
        error: errorMsg,
        isSimulated: false,
      };
    }
  }
}

let activeCrmConnector: ICrmConnector | null = null;

export function getCrmConnector(): ICrmConnector {
  if (activeCrmConnector) {
    return activeCrmConnector;
  }
  activeCrmConnector = new HubSpotCrmConnector();
  return activeCrmConnector;
}

export function setCrmConnector(connector: ICrmConnector): void {
  activeCrmConnector = connector;
}

