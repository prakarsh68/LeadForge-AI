import { getDb } from '../../db/database.js';
import type { KnowledgeSearchResult } from '../../types/index.js';
import {
  getEmbeddingProvider,
  cosineSimilarity,
} from './embeddingProvider.js';

export interface SearchOptions {
  category?: string;
  documentId?: string;
  limit?: number;
  minSimilarity?: number;
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
  'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 'like', 'through',
  'over', 'before', 'between', 'after', 'since', 'without', 'under', 'within',
  'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'how',
]);

export function tokenizeKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

export const retrievalService = {
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<KnowledgeSearchResult[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    const limit = options.limit ?? 5;
    const provider = getEmbeddingProvider();

    // Try semantic search if AI provider is configured
    if (provider.isConfigured()) {
      try {
        const semanticResults = await this.semanticSearch(
          cleanQuery,
          options,
          provider
        );
        if (semanticResults.length > 0) {
          return semanticResults.slice(0, limit);
        }
      } catch (err) {
        console.warn('Semantic search failed, falling back to keyword search:', err);
      }
    }

    // Explicit keyword search fallback
    return this.keywordSearch(cleanQuery, options, limit);
  },

  async semanticSearch(
    query: string,
    options: SearchOptions,
    provider = getEmbeddingProvider()
  ): Promise<KnowledgeSearchResult[]> {
    const db = getDb();
    const minSimilarity = options.minSimilarity ?? 0.25;

    // Generate query embedding
    const [queryVec] = await provider.generateEmbeddings([query]);
    if (!queryVec || queryVec.length === 0) {
      return [];
    }

    let sql = `
      SELECT
        c.id AS chunk_id,
        c.document_id,
        c.chunk_index,
        c.content,
        c.page_number,
        c.section_title,
        c.char_count,
        c.embedding,
        d.title AS document_title,
        d.category
      FROM knowledge_chunks c
      JOIN knowledge_documents d ON c.document_id = d.id
      WHERE c.embedding IS NOT NULL
    `;
    const params: any[] = [];

    if (options.category && options.category !== 'All') {
      sql += ' AND d.category = ?';
      params.push(options.category);
    }

    if (options.documentId) {
      sql += ' AND d.id = ?';
      params.push(options.documentId);
    }

    const rows = db.prepare(sql).all(...params) as Array<{
      chunk_id: string;
      document_id: string;
      chunk_index: number;
      content: string;
      page_number: number | null;
      section_title: string | null;
      char_count: number;
      embedding: string;
      document_title: string;
      category: string;
    }>;

    const scored: KnowledgeSearchResult[] = [];

    for (const row of rows) {
      try {
        const chunkVec = JSON.parse(row.embedding) as number[];
        const sim = cosineSimilarity(queryVec, chunkVec);
        if (sim >= minSimilarity) {
          scored.push({
            chunkId: row.chunk_id,
            documentId: row.document_id,
            documentTitle: row.document_title,
            category: row.category,
            content: row.content,
            pageNumber: row.page_number,
            sectionTitle: row.section_title,
            similarityScore: parseFloat(sim.toFixed(4)),
            searchMode: 'semantic',
          });
        }
      } catch {
        // Skip invalid JSON
      }
    }

    scored.sort((a, b) => b.similarityScore - a.similarityScore);
    return scored;
  },

  keywordSearch(
    query: string,
    options: SearchOptions = {},
    limit = 5
  ): KnowledgeSearchResult[] {
    const db = getDb();
    const keywords = tokenizeKeywords(query);

    let sql = `
      SELECT
        c.id AS chunk_id,
        c.document_id,
        c.chunk_index,
        c.content,
        c.page_number,
        c.section_title,
        c.char_count,
        d.title AS document_title,
        d.category
      FROM knowledge_chunks c
      JOIN knowledge_documents d ON c.document_id = d.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (options.category && options.category !== 'All') {
      sql += ' AND d.category = ?';
      params.push(options.category);
    }

    if (options.documentId) {
      sql += ' AND d.id = ?';
      params.push(options.documentId);
    }

    const rows = db.prepare(sql).all(...params) as Array<{
      chunk_id: string;
      document_id: string;
      chunk_index: number;
      content: string;
      page_number: number | null;
      section_title: string | null;
      char_count: number;
      document_title: string;
      category: string;
    }>;

    const scored: KnowledgeSearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    for (const row of rows) {
      const lowerContent = row.content.toLowerCase();
      const lowerTitle = row.document_title.toLowerCase();

      let matchScore = 0;

      // Exact phrase match boost
      if (lowerContent.includes(lowerQuery)) {
        matchScore += 0.5;
      }

      // Keyword matches
      let matchedKeywords = 0;
      for (const kw of keywords) {
        if (lowerContent.includes(kw)) {
          matchScore += 0.15;
          matchedKeywords++;
        }
        if (lowerTitle.includes(kw)) {
          matchScore += 0.2;
        }
      }

      // Keep if at least one match or whole query match
      if (matchScore > 0 || (keywords.length === 0 && lowerContent.includes(lowerQuery))) {
        const finalScore = Math.min(0.95, parseFloat(matchScore.toFixed(3)));
        scored.push({
          chunkId: row.chunk_id,
          documentId: row.document_id,
          documentTitle: row.document_title,
          category: row.category,
          content: row.content,
          pageNumber: row.page_number,
          sectionTitle: row.section_title,
          similarityScore: finalScore,
          searchMode: 'keyword',
        });
      }
    }

    scored.sort((a, b) => b.similarityScore - a.similarityScore);
    return scored.slice(0, limit);
  },
};
