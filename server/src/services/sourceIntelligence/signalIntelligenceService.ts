import { createHash, randomUUID } from 'node:crypto';
import { getDb } from '../../db/database.js';
import type {
  SourceSignalDTO,
  SignalCategory,
  SourceObservationDTO,
  SourceObservationEntityType,
} from '../../types/index.js';
import { sourceSignalEntityToDto, sourceObservationEntityToDto } from '../../utils/serializers.js';
import { dataQualityService } from '../dataQualityService.js';

export interface IngestSignalInput {
  companyName: string;
  companyDomain: string;
  signalCategory: SignalCategory;
  sourceId: string;
  sourceUrl?: string;
  signalText: string;
  structuredEvidence?: Record<string, any>;
  confidence?: number;
  relevanceScore?: number;
  eventTimestamp?: string;
}

export interface IngestObservationInput {
  sourceId: string;
  sourceRecordId?: string;
  entityType: SourceObservationEntityType;
  entityKey: string;
  sourceUrl?: string;
  rawPayload: Record<string, any>;
  fieldProvenance?: Record<string, any>;
  companyDomain?: string;
  contactEmail?: string;
}

export class SignalIntelligenceService {
  /**
   * Generates a deterministic deduplication fingerprint for a signal.
   */
  public static computeSignalFingerprint(domain: string, category: SignalCategory, text: string): string {
    const cleanDomain = dataQualityService.normalizeDomain(domain);
    const cleanText = text.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    return createHash('sha256')
      .update(`${cleanDomain}:${category}:${cleanText}`)
      .digest('hex');
  }

  /**
   * Generates a deterministic fingerprint for an observation payload.
   */
  public static computeObservationFingerprint(sourceId: string, entityKey: string, rawPayload: any): string {
    return createHash('sha256')
      .update(`${sourceId}:${entityKey}:${JSON.stringify(rawPayload)}`)
      .digest('hex');
  }

  /**
   * Ingests a business signal with idempotent deduplication.
   */
  public static ingestSignal(input: IngestSignalInput): SourceSignalDTO {
    const db = getDb();
    const cleanDomain = dataQualityService.normalizeDomain(input.companyDomain);
    const fingerprint = this.computeSignalFingerprint(cleanDomain, input.signalCategory, input.signalText);

    // Check if fingerprint already exists
    const existing = db.prepare('SELECT * FROM source_signals WHERE dedup_fingerprint = ?').get(fingerprint) as any;
    if (existing) {
      return sourceSignalEntityToDto(existing);
    }

    const id = `sig-${randomUUID().slice(0, 8)}`;
    const eventTimestamp = input.eventTimestamp || new Date().toISOString();
    const confidence = input.confidence != null ? input.confidence : 0.90;
    const relevanceScore = input.relevanceScore != null ? input.relevanceScore : 75;
    const evidenceStr = JSON.stringify(input.structuredEvidence || {});

    db.prepare(`
      INSERT INTO source_signals (
        id, company_name, company_domain, signal_category, source_id,
        source_url, event_timestamp, observed_at, signal_text,
        structured_evidence, confidence, relevance_score, dedup_fingerprint, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      id,
      input.companyName,
      cleanDomain,
      input.signalCategory,
      input.sourceId,
      input.sourceUrl || null,
      eventTimestamp,
      input.signalText,
      evidenceStr,
      confidence,
      relevanceScore,
      fingerprint
    );

    const created = db.prepare('SELECT * FROM source_signals WHERE id = ?').get(id) as any;
    return sourceSignalEntityToDto(created);
  }

  /**
   * Ingests raw source observation and tracks provenance.
   */
  public static ingestObservation(input: IngestObservationInput): SourceObservationDTO {
    const db = getDb();
    const fingerprint = this.computeObservationFingerprint(input.sourceId, input.entityKey, input.rawPayload);

    const existing = db.prepare('SELECT * FROM source_observations WHERE fingerprint = ?').get(fingerprint) as any;
    if (existing) {
      return sourceObservationEntityToDto(existing);
    }

    const id = `obs-${randomUUID().slice(0, 8)}`;
    const companyDomain = input.companyDomain ? dataQualityService.normalizeDomain(input.companyDomain) : null;
    const contactEmail = input.contactEmail ? input.contactEmail.trim().toLowerCase() : null;

    db.prepare(`
      INSERT INTO source_observations (
        id, source_id, source_record_id, entity_type, entity_key,
        observed_at, retrieved_at, source_url, raw_payload,
        field_provenance, fingerprint, processing_status,
        company_domain, contact_email, created_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?, ?, ?, ?, 'normalized', ?, ?, datetime('now'))
    `).run(
      id,
      input.sourceId,
      input.sourceRecordId || null,
      input.entityType,
      input.entityKey,
      input.sourceUrl || null,
      JSON.stringify(input.rawPayload),
      JSON.stringify(input.fieldProvenance || {}),
      fingerprint,
      companyDomain,
      contactEmail
    );

    const created = db.prepare('SELECT * FROM source_observations WHERE id = ?').get(id) as any;
    return sourceObservationEntityToDto(created);
  }

  /**
   * Retrieves signals by domain.
   */
  public static getSignalsByDomain(domain: string): SourceSignalDTO[] {
    const db = getDb();
    const cleanDomain = dataQualityService.normalizeDomain(domain);
    const rows = db.prepare(
      'SELECT * FROM source_signals WHERE company_domain = ? ORDER BY relevance_score DESC, created_at DESC'
    ).all(cleanDomain) as any[];
    return rows.map(sourceSignalEntityToDto);
  }

  /**
   * Retrieves recent signals across all companies.
   */
  public static getAllSignals(category?: SignalCategory, limit: number = 50): SourceSignalDTO[] {
    const db = getDb();
    let sql = 'SELECT * FROM source_signals WHERE 1=1';
    const params: any[] = [];

    if (category) {
      sql += ' AND signal_category = ?';
      params.push(category);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map(sourceSignalEntityToDto);
  }
}

