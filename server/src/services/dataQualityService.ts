import type {
  FieldProvenance,
  FieldConflict,
} from '../types/index.js';

export type QualityTier = 'manual' | 'verified_provider' | 'inferred_provider' | 'unverified_provider' | 'empty';

export const dataQualityService = {
  /**
   * Normalize an email address consistently: lowercase and trimmed.
   */
  normalizeEmail(raw?: string | null): string {
    if (!raw) return '';
    return raw.trim().toLowerCase();
  },

  /**
   * Normalize a corporate domain consistently:
   * Strips protocols, www, ports, paths, and lowercase trims.
   */
  normalizeDomain(raw?: string | null): string {
    if (!raw) return '';
    return raw
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0]
      .split(':')[0]
      .trim();
  },

  /**
   * Normalize company name consistently: trimmed and stripped of trailing corporate legal suffixes if needed,
   * while preserving the authentic registered brand name.
   */
  normalizeCompany(raw?: string | null): string {
    if (!raw) return '';
    return raw.trim();
  },

  /**
   * Normalize professional job title.
   */
  normalizeTitle(raw?: string | null): string {
    if (!raw) return '';
    return raw.trim();
  },

  /**
   * Evaluate the deterministic quality rank of a field value.
   * Rank 4 (Highest): Manual edit by user or manual entry.
   * Rank 3: Verified provider evidence (emailVerification === 'verified' or confidence >= 80).
   * Rank 2: Inferred or risky provider evidence (inferred pattern, risky/catch-all, confidence 50-79).
   * Rank 1: Unverified or undeliverable provider evidence.
   * Rank 0: Empty or missing value.
   */
  getQualityRank(provenance?: FieldProvenance | null, isManual: boolean = false): number {
    if (isManual) return 4;
    if (!provenance || provenance.value === null || provenance.value === undefined || provenance.value === '') {
      return 0;
    }

    if (provenance.sourceProvider === 'manual') {
      return 4;
    }

    const verification = provenance.verificationStatus;
    const confidence = provenance.confidence;

    if (verification === 'verified' || (confidence !== null && confidence !== undefined && confidence >= 80)) {
      return 3;
    }

    if (verification === 'inferred' || verification === 'risky' || (confidence !== null && confidence !== undefined && confidence >= 50)) {
      return 2;
    }

    return 1;
  },

  /**
   * Determine if a prospective incoming field value should overwrite an existing field value,
   * based on deterministic precedence rules.
   */
  shouldOverwriteField(
    existingValue: any,
    existingProv?: FieldProvenance | null,
    incomingValue?: any,
    incomingProv?: FieldProvenance | null,
    isExistingManual: boolean = false
  ): {
    shouldOverwrite: boolean;
    reason: 'missing_existing' | 'higher_precedence' | 'same_value' | 'incoming_empty' | 'lower_or_equal_precedence';
  } {
    const isIncomingEmpty = incomingValue === null || incomingValue === undefined || incomingValue === '';
    const isExistingEmpty = existingValue === null || existingValue === undefined || existingValue === '';

    if (isIncomingEmpty) {
      return { shouldOverwrite: false, reason: 'incoming_empty' };
    }

    if (isExistingEmpty) {
      return { shouldOverwrite: true, reason: 'missing_existing' };
    }

    // Compare string values (normalized where applicable)
    const strExisting = String(existingValue).trim().toLowerCase();
    const strIncoming = String(incomingValue).trim().toLowerCase();
    if (strExisting === strIncoming) {
      return { shouldOverwrite: false, reason: 'same_value' };
    }

    // Both exist and have different values. Evaluate quality ranks.
    const existingRank = this.getQualityRank(existingProv, isExistingManual);
    const incomingRank = this.getQualityRank(incomingProv, false);

    if (incomingRank > existingRank) {
      return { shouldOverwrite: true, reason: 'higher_precedence' };
    }

    return { shouldOverwrite: false, reason: 'lower_or_equal_precedence' };
  },

  /**
   * Apply data quality policies when merging or updating lead fields with new evidence.
   * Records conflicting evidence into conflictHistory without corrupting stronger data.
   */
  evaluateFieldUpdate(
    fieldName: string,
    existingValue: any,
    existingProvenance: FieldProvenance | undefined,
    incomingValue: any,
    incomingProvenance: FieldProvenance | undefined,
    isExistingManual: boolean = false
  ): {
    finalValue: any;
    finalProvenance: FieldProvenance | undefined;
    conflict: FieldConflict | null;
  } {
    const check = this.shouldOverwriteField(
      existingValue,
      existingProvenance,
      incomingValue,
      incomingProvenance,
      isExistingManual
    );

    const now = new Date().toISOString();

    if (check.shouldOverwrite) {
      // Overwrite permitted
      let conflict: FieldConflict | null = null;
      if (check.reason === 'higher_precedence') {
        conflict = {
          fieldName,
          existingValue,
          existingSource: existingProvenance?.sourceProvider || (isExistingManual ? 'manual' : 'unknown'),
          existingStatus: existingProvenance?.verificationStatus,
          conflictingValue: incomingValue,
          conflictingSource: incomingProvenance?.sourceProvider || 'provider',
          conflictingStatus: incomingProvenance?.verificationStatus,
          recordedAt: now,
          resolution: 'overwritten_by_higher_precedence',
        };
      }

      return {
        finalValue: incomingValue,
        finalProvenance: incomingProvenance || existingProvenance,
        conflict,
      };
    } else {
      // Preserve existing
      let conflict: FieldConflict | null = null;
      if (check.reason === 'lower_or_equal_precedence') {
        conflict = {
          fieldName,
          existingValue,
          existingSource: existingProvenance?.sourceProvider || (isExistingManual ? 'manual' : 'unknown'),
          existingStatus: existingProvenance?.verificationStatus,
          conflictingValue: incomingValue,
          conflictingSource: incomingProvenance?.sourceProvider || 'provider',
          conflictingStatus: incomingProvenance?.verificationStatus,
          recordedAt: now,
          resolution: 'preserved_existing',
        };
      }

      return {
        finalValue: existingValue,
        finalProvenance: existingProvenance,
        conflict,
      };
    }
  },

  /**
   * Check if a set of updates materially changes scoring-relevant criteria.
   * Scoring-relevant criteria: industry, company_size, title, company, triggers.
   * Non-scoring fields: notes, avatar, deal_value, status, last_active, linkedin, location.
   */
  isScoringCriteriaChanged(
    currentLead: {
      industry?: string;
      company_size?: string;
      companySize?: string;
      title?: string;
      company?: string;
      triggers?: string[] | string;
    },
    updates: {
      industry?: string;
      company_size?: string;
      companySize?: string;
      title?: string;
      company?: string;
      triggers?: string[];
    }
  ): boolean {
    if (updates.industry !== undefined && updates.industry.trim() !== (currentLead.industry || '').trim()) {
      return true;
    }

    const currentSize = (currentLead.companySize || currentLead.company_size || '').trim();
    const newSize = (updates.companySize || updates.company_size || '').trim();
    if ((updates.companySize !== undefined || updates.company_size !== undefined) && newSize !== currentSize) {
      return true;
    }

    if (updates.title !== undefined && updates.title.trim().toLowerCase() !== (currentLead.title || '').trim().toLowerCase()) {
      return true;
    }

    if (updates.company !== undefined && updates.company.trim().toLowerCase() !== (currentLead.company || '').trim().toLowerCase()) {
      return true;
    }

    if (updates.triggers !== undefined) {
      let currentTriggers: string[] = [];
      if (Array.isArray(currentLead.triggers)) {
        currentTriggers = currentLead.triggers;
      } else if (typeof currentLead.triggers === 'string') {
        try {
          currentTriggers = JSON.parse(currentLead.triggers);
        } catch {
          currentTriggers = [];
        }
      }
      const curSorted = [...currentTriggers].sort().join('||');
      const newSorted = [...updates.triggers].sort().join('||');
      if (curSorted !== newSorted) {
        return true;
      }
    }

    return false;
  },
};
