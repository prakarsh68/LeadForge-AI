import { getDb } from '../db/database.js';
import type { KnowledgeDocumentEntity, KnowledgeDocumentDTO } from '../types/index.js';
import { knowledgeDocEntityToDto } from '../utils/serializers.js';
import { ALLOWED_DOC_CATEGORIES, ALLOWED_DOC_TYPES } from '../utils/validators.js';
import { activityService } from './activityService.js';
import { knowledgePipelineService } from './knowledge/knowledgePipelineService.js';

export interface CreateKnowledgeDocInput {
  title: string;
  category: 'Product Specs' | 'Battlecards' | 'Case Studies' | 'Pricing' | 'Compliance';
  type: 'pdf' | 'doc' | 'url' | 'notion';
  sizeOrTokens?: string;
  status?: 'Indexed' | 'Syncing' | 'Ready';
  uploadedAt?: string;
  summary?: string;
}

export interface UpdateKnowledgeDocInput {
  title?: string;
  category?: 'Product Specs' | 'Battlecards' | 'Case Studies' | 'Pricing' | 'Compliance';
  type?: 'pdf' | 'doc' | 'url' | 'notion';
  sizeOrTokens?: string;
  status?: 'Indexed' | 'Syncing' | 'Ready';
  uploadedAt?: string;
  summary?: string;
}

export const knowledgeService = {
  getAll(filters: { category?: string; status?: string; search?: string } = {}): KnowledgeDocumentDTO[] {
    const db = getDb();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.category && ALLOWED_DOC_CATEGORIES.includes(filters.category as any)) {
      conditions.push('category = ?');
      params.push(filters.category);
    }

    if (filters.status && ['Indexed', 'Syncing', 'Ready'].includes(filters.status)) {
      conditions.push('status = ?');
      params.push(filters.status);
    }

    if (filters.search && filters.search.trim()) {
      conditions.push('(title LIKE ? OR summary LIKE ?)');
      const term = `%${filters.search.trim()}%`;
      params.push(term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT * FROM knowledge_documents
      ${whereClause}
      ORDER BY created_at DESC
    `;

    const rows = db.prepare(query).all(...params) as KnowledgeDocumentEntity[];
    return rows.map(knowledgeDocEntityToDto);
  },

  getById(id: string): KnowledgeDocumentDTO | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM knowledge_documents WHERE id = ?').get(id) as KnowledgeDocumentEntity | undefined;
    return row ? knowledgeDocEntityToDto(row) : null;
  },

  create(data: CreateKnowledgeDocInput): KnowledgeDocumentDTO {
    const db = getDb();

    if (!data.title || !data.title.trim()) {
      throw new Error('Document title is required');
    }
    if (!data.category || !ALLOWED_DOC_CATEGORIES.includes(data.category)) {
      throw new Error(`Category must be one of: ${ALLOWED_DOC_CATEGORIES.join(', ')}`);
    }
    if (!data.type || !ALLOWED_DOC_TYPES.includes(data.type)) {
      throw new Error(`Type must be one of: ${ALLOWED_DOC_TYPES.join(', ')}`);
    }

    const id = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const sizeOrTokens = data.sizeOrTokens || '1.2 MB • 8,400 tokens';
    const status = data.status || 'Indexed';
    const uploadedAt = data.uploadedAt || 'Just now';
    const summary = data.summary || '';

    const insertStmt = db.prepare(`
      INSERT INTO knowledge_documents (
        id, title, category, type, size_or_tokens, status, uploaded_at, summary, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    insertStmt.run(
      id,
      data.title.trim(),
      data.category,
      data.type,
      sizeOrTokens,
      status,
      uploadedAt,
      summary
    );

    activityService.log(
      'discovery',
      'Knowledge Asset Uploaded',
      `Document "${data.title}" indexed for AI agent context grounding`,
      data.category
    );

    const created = this.getById(id);
    if (!created) {
      throw new Error('Failed to retrieve newly created knowledge document');
    }

    // Create initial chunk so metadata document is searchable
    const chunkText = summary || `${data.title} (${data.category})`;
    db.prepare(`
      INSERT OR IGNORE INTO knowledge_chunks (
        id, document_id, chunk_index, content, page_number, section_title, char_count
      ) VALUES (?, ?, 0, ?, 1, 'Overview', ?)
    `).run(`chunk-${id}-0`, id, chunkText, chunkText.length);
    db.prepare("UPDATE knowledge_documents SET chunk_count = 1, processing_status = 'indexed' WHERE id = ?").run(id);

    return this.getById(id)!;
  },

  update(id: string, updates: UpdateKnowledgeDocInput): KnowledgeDocumentDTO {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM knowledge_documents WHERE id = ?').get(id) as KnowledgeDocumentEntity | undefined;
    if (!existing) {
      throw new Error(`Knowledge document not found with id: ${id}`);
    }

    if (updates.category !== undefined && !ALLOWED_DOC_CATEGORIES.includes(updates.category)) {
      throw new Error(`Category must be one of: ${ALLOWED_DOC_CATEGORIES.join(', ')}`);
    }
    if (updates.type !== undefined && !ALLOWED_DOC_TYPES.includes(updates.type)) {
      throw new Error(`Type must be one of: ${ALLOWED_DOC_TYPES.join(', ')}`);
    }
    if (updates.status !== undefined && !['Indexed', 'Syncing', 'Ready'].includes(updates.status)) {
      throw new Error('Status must be Indexed, Syncing, or Ready');
    }

    const fieldsToUpdate: string[] = ['updated_at = datetime(\'now\')'];
    const params: any[] = [];

    if (updates.title !== undefined) {
      fieldsToUpdate.push('title = ?');
      params.push(updates.title.trim());
    }
    if (updates.category !== undefined) {
      fieldsToUpdate.push('category = ?');
      params.push(updates.category);
    }
    if (updates.type !== undefined) {
      fieldsToUpdate.push('type = ?');
      params.push(updates.type);
    }
    if (updates.sizeOrTokens !== undefined) {
      fieldsToUpdate.push('size_or_tokens = ?');
      params.push(updates.sizeOrTokens);
    }
    if (updates.status !== undefined) {
      fieldsToUpdate.push('status = ?');
      params.push(updates.status);
    }
    if (updates.uploadedAt !== undefined) {
      fieldsToUpdate.push('uploaded_at = ?');
      params.push(updates.uploadedAt);
    }
    if (updates.summary !== undefined) {
      fieldsToUpdate.push('summary = ?');
      params.push(updates.summary);
    }

    params.push(id);
    db.prepare(`UPDATE knowledge_documents SET ${fieldsToUpdate.join(', ')} WHERE id = ?`).run(...params);

    const updated = this.getById(id);
    if (!updated) {
      throw new Error('Failed to retrieve updated knowledge document');
    }
    return updated;
  },

  delete(id: string): boolean {
    return knowledgePipelineService.deleteDocument(id);
  },
};

