import { randomUUID } from 'node:crypto';
import { getDb } from '../../db/database.js';
import { dataQualityService } from '../dataQualityService.js';
import type {
  FieldProvenance,
  FieldConflict,
  SourceAttributionRole,
  VerificationStatus,
} from '../../types/index.js';

export interface UnresolvedEntityFragment {
  sourceId: string;
  sourceUrl?: string;
  role: SourceAttributionRole;
  confidence: number;
  companyName: string;
  companyDomain: string;
  contactName?: string;
  title?: string;
  email?: string;
  emailVerification?: VerificationStatus;
  linkedinUrl?: string;
  location?: string;
  industry?: string;
  companySize?: string;
  triggers?: string[];
  rawPayload?: Record<string, any>;
}

export interface UnifiedResolvedCandidate {
  id: string;
  companyName: string;
  companyDomain: string;
  contactName: string;
  title: string;
  email?: string;
  emailVerification: VerificationStatus;
  confidenceScore: number;
  linkedin?: string;
  location?: string;
  industry?: string;
  companySize?: string;
  triggers: string[];
  sourceUrls: string[];
  primarySourceId: string;
  provenanceByField: Record<string, FieldProvenance>;
  conflictHistory: FieldConflict[];
  contributingSources: Array<{ sourceId: string; role: SourceAttributionRole; confidence: number }>;
}

export class SourceIdentityResolutionService {
  /**
   * Generates a canonical resolution key for an entity (email if present, otherwise domain).
   */
  public static getCanonicalKey(fragment: { companyDomain: string; email?: string }): string {
    const cleanEmail = dataQualityService.normalizeEmail(fragment.email);
    if (cleanEmail) return `email:${cleanEmail}`;
    return `domain:${dataQualityService.normalizeDomain(fragment.companyDomain)}`;
  }

  /**
   * Merges multiple entity fragments across sources into a unified candidate entity.
   */
  public static resolveAndMergeEntities(fragments: UnresolvedEntityFragment[]): UnifiedResolvedCandidate[] {
    const domainMap = new Map<string, UnresolvedEntityFragment[]>();

    // 1. Group fragments by clean company domain
    for (const fragment of fragments) {
      const cleanDomain = dataQualityService.normalizeDomain(fragment.companyDomain);
      if (!cleanDomain) continue;

      if (!domainMap.has(cleanDomain)) {
        domainMap.set(cleanDomain, []);
      }
      domainMap.get(cleanDomain)!.push(fragment);
    }

    const clusters: UnresolvedEntityFragment[][] = [];

    // 2. Form clusters per domain: combine company signals with contact entities
    for (const [, domainFragments] of domainMap.entries()) {
      const companySignals = domainFragments.filter((f) => !f.email && !f.contactName);
      const contactFragments = domainFragments.filter((f) => !!f.email || !!f.contactName);

      if (contactFragments.length === 0) {
        clusters.push(companySignals);
      } else {
        const contactGroups = new Map<string, UnresolvedEntityFragment[]>();
        for (const cf of contactFragments) {
          const cKey = cf.email ? dataQualityService.normalizeEmail(cf.email) : (cf.contactName || '').toLowerCase().trim();
          if (!contactGroups.has(cKey)) {
            contactGroups.set(cKey, []);
          }
          contactGroups.get(cKey)!.push(cf);
        }

        for (const cGroup of contactGroups.values()) {
          // Merge contact-specific fragments with the shared company-level signals
          clusters.push([...companySignals, ...cGroup]);
        }
      }
    }

    const resolvedList: UnifiedResolvedCandidate[] = [];

    // 3. Resolve each cluster into a single entity
    for (const clusterFragments of clusters) {
      if (clusterFragments.length === 0) continue;

      const id = `cand-resolved-${randomUUID().slice(0, 8)}`;
      const cleanDomain = dataQualityService.normalizeDomain(clusterFragments[0].companyDomain);
      let companyName = '';
      let contactName = '';
      let title = '';
      let email: string | undefined = undefined;
      let emailVerification: VerificationStatus = 'unverified';
      let confidenceScore = 80;
      let linkedin: string | undefined = undefined;
      let location: string | undefined = undefined;
      let industry: string | undefined = undefined;
      let companySize: string | undefined = undefined;
      let primarySourceId = clusterFragments[0].sourceId;
      const triggersSet = new Set<string>();
      const sourceUrlsSet = new Set<string>();
      const provenanceByField: Record<string, FieldProvenance> = {};
      const conflictHistory: FieldConflict[] = [];
      const contributingSources: Array<{ sourceId: string; role: SourceAttributionRole; confidence: number }> = [];

      for (const f of clusterFragments) {
        contributingSources.push({
          sourceId: f.sourceId,
          role: f.role,
          confidence: f.confidence,
        });

        if (f.sourceUrl) sourceUrlsSet.add(f.sourceUrl);
        if (f.triggers) {
          f.triggers.forEach((t) => triggersSet.add(t));
        }

        // Field reconciliation using precedence rank
        const fProv: FieldProvenance = {
          fieldName: 'email',
          value: f.email,
          sourceProvider: f.sourceId,
          retrievedAt: new Date().toISOString(),
          confidence: Math.round((f.confidence || 0.8) * 100),
          verificationStatus: f.emailVerification || 'unverified',
        };

        if (f.email) {
          const currentEmailProv = provenanceByField.email;
          if (!currentEmailProv) {
            email = dataQualityService.normalizeEmail(f.email);
            emailVerification = f.emailVerification || 'unverified';
            provenanceByField.email = fProv;
          } else {
            const currentRank = dataQualityService.getQualityRank(currentEmailProv);
            const newRank = dataQualityService.getQualityRank(fProv);
            if (newRank > currentRank) {
              conflictHistory.push({
                fieldName: 'email',
                existingValue: email,
                existingSource: currentEmailProv.sourceProvider,
                existingStatus: currentEmailProv.verificationStatus,
                conflictingValue: dataQualityService.normalizeEmail(f.email),
                conflictingSource: f.sourceId,
                conflictingStatus: fProv.verificationStatus,
                recordedAt: new Date().toISOString(),
                resolution: 'overwritten_by_higher_precedence',
              });
              email = dataQualityService.normalizeEmail(f.email);
              emailVerification = f.emailVerification || 'unverified';
              provenanceByField.email = fProv;
            }
          }
        }

        if (f.contactName && !contactName) {
          contactName = f.contactName;
          provenanceByField.contactName = {
            fieldName: 'contactName',
            value: f.contactName,
            sourceProvider: f.sourceId,
            retrievedAt: new Date().toISOString(),
            confidence: Math.round(f.confidence * 100),
            verificationStatus: 'unverified',
          };
        }

        if (f.title && !title) {
          title = f.title;
          provenanceByField.title = {
            fieldName: 'title',
            value: f.title,
            sourceProvider: f.sourceId,
            retrievedAt: new Date().toISOString(),
            confidence: Math.round(f.confidence * 100),
            verificationStatus: 'unverified',
          };
        }

        if (f.industry && !industry) {
          industry = f.industry;
        }

        if (f.companySize && !companySize) {
          companySize = f.companySize;
        }

        if (f.location && !location) {
          location = f.location;
        }

        if (f.linkedinUrl && !linkedin) {
          linkedin = f.linkedinUrl;
        }

        if (f.companyName && !companyName) {
          companyName = dataQualityService.normalizeCompany(f.companyName);
        }

        if (f.confidence) {
          confidenceScore = Math.max(confidenceScore, Math.round(f.confidence * 100));
        }

        if (f.role === 'contact_resolution' || f.email) {
          primarySourceId = f.sourceId;
        }
      }

      resolvedList.push({
        id,
        companyName: companyName || cleanDomain,
        companyDomain: cleanDomain,
        contactName: contactName || 'Executive Decision Maker',
        title: title || 'Executive',
        email,
        emailVerification,
        confidenceScore,
        linkedin,
        location,
        industry,
        companySize,
        triggers: Array.from(triggersSet),
        sourceUrls: Array.from(sourceUrlsSet),
        primarySourceId,
        provenanceByField,
        conflictHistory,
        contributingSources,
      });
    }

    return resolvedList;
  }

  /**
   * Records source attributions for a candidate or lead.
   */
  public static recordAttributions(
    contributingSources: Array<{ sourceId: string; role: SourceAttributionRole; confidence: number }>,
    candidateId?: string,
    leadId?: string
  ): void {
    const db = getDb();
    const validCandidateId = candidateId && db.prepare('SELECT 1 FROM discovered_candidates WHERE id = ?').get(candidateId) ? candidateId : null;
    const validLeadId = leadId && db.prepare('SELECT 1 FROM leads WHERE id = ?').get(leadId) ? leadId : null;

    const insert = db.prepare(`
      INSERT INTO source_attributions (
        id, lead_id, candidate_id, source_id, role, confidence, attributed_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    const insertTx = db.transaction((sources) => {
      for (const s of sources) {
        insert.run(
          `attr-${randomUUID().slice(0, 8)}`,
          validLeadId,
          validCandidateId,
          s.sourceId,
          s.role,
          s.confidence
        );
      }
    });

    insertTx(contributingSources);
  }
}
