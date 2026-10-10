import crypto from 'node:crypto';
import { getDb } from '../../db/database.js';

export interface CrawlSourceProfile {
  id: string;
  name: string;
  description: string;
  startUrls: string[];
  allowedDomains: string[];
  crawlDepth: number;
  maxPages: number;
  concurrency: number;
  delayMs: number;
  extractionTypes: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export class CrawlProfileService {
  /**
   * Get all registered crawl source profiles.
   */
  public static getAllProfiles(): CrawlSourceProfile[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM crawl_source_profiles ORDER BY created_at DESC').all() as any[];
    return rows.map(this.rowToProfile);
  }

  /**
   * Get an active source profile by ID.
   */
  public static getProfile(id: string): CrawlSourceProfile | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM crawl_source_profiles WHERE id = ?').get(id) as any;
    return row ? this.rowToProfile(row) : null;
  }

  /**
   * Create or update a crawl source profile.
   */
  public static saveProfile(profileData: {
    id?: string;
    name: string;
    description?: string;
    startUrls: string[];
    allowedDomains: string[];
    crawlDepth?: number;
    maxPages?: number;
    concurrency?: number;
    delayMs?: number;
    extractionTypes?: string[];
    isActive?: boolean;
  }): CrawlSourceProfile {
    const db = getDb();
    const id = profileData.id || `sp-${crypto.randomUUID().slice(0, 8)}`;
    const description = profileData.description || 'Configured public website source profile for Crawlee.';
    const crawlDepth = Math.min(Math.max(profileData.crawlDepth ?? 2, 1), 3); // conservative clamp [1, 3]
    const maxPages = Math.min(Math.max(profileData.maxPages ?? 50, 1), 200); // conservative clamp [1, 200]
    const concurrency = Math.min(Math.max(profileData.concurrency ?? 2, 1), 5); // clamp [1, 5]
    const delayMs = Math.max(profileData.delayMs ?? 1000, 500); // at least 500ms
    const extractionTypes = profileData.extractionTypes || [
      'company_metadata',
      'hiring_signals',
      'technology_signals',
      'public_contacts',
    ];
    const isActive = profileData.isActive ?? true;

    db.prepare(`
      INSERT INTO crawl_source_profiles (
        id, name, description, start_urls, allowed_domains, crawl_depth,
        max_pages, concurrency, delay_ms, extraction_types, is_active,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        start_urls = excluded.start_urls,
        allowed_domains = excluded.allowed_domains,
        crawl_depth = excluded.crawl_depth,
        max_pages = excluded.max_pages,
        concurrency = excluded.concurrency,
        delay_ms = excluded.delay_ms,
        extraction_types = excluded.extraction_types,
        is_active = excluded.is_active,
        updated_at = datetime('now')
    `).run(
      id,
      profileData.name,
      description,
      JSON.stringify(profileData.startUrls),
      JSON.stringify(profileData.allowedDomains),
      crawlDepth,
      maxPages,
      concurrency,
      delayMs,
      JSON.stringify(extractionTypes),
      isActive ? 1 : 0
    );

    return this.getProfile(id)!;
  }

  /**
   * Delete a crawl source profile.
   */
  public static deleteProfile(id: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM crawl_source_profiles WHERE id = ?').run(id);
    return result.changes > 0;
  }

  private static rowToProfile(row: any): CrawlSourceProfile {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      startUrls: JSON.parse(row.start_urls || '[]'),
      allowedDomains: JSON.parse(row.allowed_domains || '[]'),
      crawlDepth: row.crawl_depth,
      maxPages: row.max_pages,
      concurrency: row.concurrency,
      delayMs: row.delay_ms,
      extractionTypes: JSON.parse(row.extraction_types || '[]'),
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

