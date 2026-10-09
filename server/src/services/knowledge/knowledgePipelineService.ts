import path from 'node:path';
import { getDb } from '../../db/database.js';
import type {
  KnowledgeDocumentEntity,
  KnowledgeDocumentDTO,
  KnowledgeChunkEntity,
  KnowledgeChunkDTO,
  KnowledgeConfigDTO,
} from '../../types/index.js';
import {
  knowledgeDocEntityToDto,
  knowledgeChunkEntityToDto,
} from '../../utils/serializers.js';
import { activityService } from '../activityService.js';
import { fileStorageService } from './fileStorageService.js';
import { textExtractorService } from './textExtractorService.js';
import { chunkingService } from './chunkingService.js';
import { getEmbeddingProvider } from './embeddingProvider.js';

export interface IngestFileInput {
  fileBuffer: Buffer;
  originalName: string;
  title?: string;
  category: 'Product Specs' | 'Battlecards' | 'Case Studies' | 'Pricing' | 'Compliance';
  summary?: string;
  mimeType?: string;
}

export function inferDocumentType(
  filename: string
): 'pdf' | 'doc' | 'docx' | 'txt' | 'md' | 'url' | 'notion' {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.pdf':
      return 'pdf';
    case '.docx':
      return 'docx';
    case '.doc':
      return 'doc';
    case '.md':
    case '.markdown':
      return 'md';
    case '.txt':
      return 'txt';
    default:
      return 'doc';
  }
}

export function formatFileSizeOrTokens(bytes: number, charCount: number): string {
  const mb = (bytes / (1024 * 1024)).toFixed(1);
  const kb = Math.round(bytes / 1024);
  const sizeStr = bytes >= 1024 * 1024 ? `${mb} MB` : `${kb} KB`;
  const estimatedTokens = Math.round(charCount / 4);
  return `${sizeStr} • ${estimatedTokens.toLocaleString()} tokens`;
}

export const knowledgePipelineService = {
  async ingestFile(input: IngestFileInput): Promise<KnowledgeDocumentDTO> {
    const db = getDb();
    const docId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const title = input.title?.trim() || path.basename(input.originalName, path.extname(input.originalName));
    const docType = inferDocumentType(input.originalName);

    // 1. Save file to disk
    const stored = await fileStorageService.saveFile(
      docId,
      input.originalName,
      input.fileBuffer
    );

    const initialSizeStr = formatFileSizeOrTokens(stored.fileSize, 0);

    // 2. Insert document record with 'uploaded' status
    db.prepare(`
      INSERT INTO knowledge_documents (
        id, title, category, type, size_or_tokens, status, uploaded_at, summary,
        file_path, file_size, mime_type, content_hash, processing_status,
        chunk_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'Syncing', 'Just now', ?, ?, ?, ?, ?, 'uploaded', 0, datetime('now'), datetime('now'))
    `).run(
      docId,
      title,
      input.category,
      docType,
      initialSizeStr,
      input.summary || '',
      stored.filePath,
      stored.fileSize,
      input.mimeType || null,
      stored.contentHash
    );

    try {
      // 3. Extract text
      db.prepare(
        "UPDATE knowledge_documents SET processing_status = 'extracting', updated_at = datetime('now') WHERE id = ?"
      ).run(docId);

      const extracted = await textExtractorService.extractText(
        input.fileBuffer,
        input.originalName,
        input.mimeType
      );

      // Auto-generate summary from first extracted lines if not provided
      const summary =
        input.summary?.trim() ||
        (extracted.fullText.length > 250
          ? `${extracted.fullText.substring(0, 240)}...`
          : extracted.fullText || 'Collateral indexed for AI agent context grounding.');

      const finalSizeStr = formatFileSizeOrTokens(stored.fileSize, extracted.charCount);

      // 4. Chunk text
      db.prepare(
        "UPDATE knowledge_documents SET processing_status = 'chunking', summary = ?, size_or_tokens = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(summary, finalSizeStr, docId);

      const chunks = chunkingService.createChunks(docId, extracted.sections);

      // Save chunks to database
      const insertChunkStmt = db.prepare(`
        INSERT INTO knowledge_chunks (
          id, document_id, chunk_index, content, page_number, section_title, char_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const insertAllChunks = db.transaction((chunksList) => {
        for (const c of chunksList) {
          insertChunkStmt.run(
            c.id,
            c.documentId,
            c.chunkIndex,
            c.content,
            c.pageNumber,
            c.sectionTitle,
            c.charCount
          );
        }
      });

      insertAllChunks(chunks);

      // 5. Generate embeddings if AI provider is configured
      const provider = getEmbeddingProvider();
      let embeddingModel: string | null = null;

      if (provider.isConfigured() && chunks.length > 0) {
        db.prepare(
          "UPDATE knowledge_documents SET processing_status = 'indexing', updated_at = datetime('now') WHERE id = ?"
        ).run(docId);

        embeddingModel = provider.getEmbeddingModel();
        const batchSize = 16;
        const updateChunkStmt = db.prepare(
          'UPDATE knowledge_chunks SET embedding = ?, embedding_model = ? WHERE id = ?'
        );

        for (let i = 0; i < chunks.length; i += batchSize) {
          const batch = chunks.slice(i, i + batchSize);
          const texts = batch.map((c) => c.content);
          const embeddings = await provider.generateEmbeddings(texts);

          for (let j = 0; j < batch.length; j++) {
            if (embeddings[j]) {
              updateChunkStmt.run(
                JSON.stringify(embeddings[j]),
                embeddingModel,
                batch[j].id
              );
            }
          }
        }
      }

      // 6. Complete indexing
      db.prepare(`
        UPDATE knowledge_documents SET
          processing_status = 'indexed',
          status = 'Indexed',
          chunk_count = ?,
          indexed_at = datetime('now'),
          embedding_model = ?,
          error_message = NULL,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(chunks.length, embeddingModel, docId);

      activityService.log(
        'discovery',
        'Knowledge Asset Ingested',
        `Document "${title}" parsed into ${chunks.length} chunks for agent grounding`,
        input.category
      );

      const finalDoc = db
        .prepare('SELECT * FROM knowledge_documents WHERE id = ?')
        .get(docId) as KnowledgeDocumentEntity;

      return knowledgeDocEntityToDto(finalDoc);
    } catch (err: any) {
      console.error(`Error processing knowledge document ${docId}:`, err);
      db.prepare(`
        UPDATE knowledge_documents SET
          processing_status = 'failed',
          status = 'Ready',
          error_message = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(err.message || String(err), docId);

      throw err;
    }
  },

  async reindexDocument(docId: string): Promise<KnowledgeDocumentDTO> {
    const db = getDb();
    const doc = db
      .prepare('SELECT * FROM knowledge_documents WHERE id = ?')
      .get(docId) as KnowledgeDocumentEntity | undefined;

    if (!doc) {
      throw new Error(`Knowledge document not found: ${docId}`);
    }

    // Set status to syncing / chunking
    db.prepare(`
      UPDATE knowledge_documents SET
        processing_status = 'chunking',
        status = 'Syncing',
        updated_at = datetime('now')
      WHERE id = ?
    `).run(docId);

    try {
      // Clear old chunks
      db.prepare('DELETE FROM knowledge_chunks WHERE document_id = ?').run(docId);

      let sections: Array<{ text: string; pageNumber?: number | null; sectionTitle?: string | null }> = [];

      // Check if file is available on disk
      if (doc.file_path) {
        const buffer = await fileStorageService.readFile(doc.file_path);
        const extracted = await textExtractorService.extractText(
          buffer,
          path.basename(doc.file_path),
          doc.mime_type || undefined
        );
        sections = extracted.sections;
      } else {
        // Fallback for seed or summary documents
        const textToUse = doc.summary || doc.title;
        sections = [{ text: textToUse, sectionTitle: 'Overview' }];
      }

      const chunks = chunkingService.createChunks(docId, sections);

      const insertChunkStmt = db.prepare(`
        INSERT INTO knowledge_chunks (
          id, document_id, chunk_index, content, page_number, section_title, char_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const c of chunks) {
        insertChunkStmt.run(
          c.id,
          c.documentId,
          c.chunkIndex,
          c.content,
          c.pageNumber,
          c.sectionTitle,
          c.charCount
        );
      }

      const provider = getEmbeddingProvider();
      let embeddingModel: string | null = null;

      if (provider.isConfigured() && chunks.length > 0) {
        embeddingModel = provider.getEmbeddingModel();
        const batchSize = 16;
        const updateChunkStmt = db.prepare(
          'UPDATE knowledge_chunks SET embedding = ?, embedding_model = ? WHERE id = ?'
        );

        for (let i = 0; i < chunks.length; i += batchSize) {
          const batch = chunks.slice(i, i + batchSize);
          const texts = batch.map((c) => c.content);
          const embeddings = await provider.generateEmbeddings(texts);

          for (let j = 0; j < batch.length; j++) {
            if (embeddings[j]) {
              updateChunkStmt.run(
                JSON.stringify(embeddings[j]),
                embeddingModel,
                batch[j].id
              );
            }
          }
        }
      }

      db.prepare(`
        UPDATE knowledge_documents SET
          processing_status = 'indexed',
          status = 'Indexed',
          chunk_count = ?,
          indexed_at = datetime('now'),
          embedding_model = ?,
          error_message = NULL,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(chunks.length, embeddingModel, docId);

      activityService.log(
        'discovery',
        'Knowledge Asset Re-indexed',
        `Re-embedded ${chunks.length} chunks for "${doc.title}"`,
        doc.category
      );

      const updated = db
        .prepare('SELECT * FROM knowledge_documents WHERE id = ?')
        .get(docId) as KnowledgeDocumentEntity;

      return knowledgeDocEntityToDto(updated);
    } catch (err: any) {
      db.prepare(`
        UPDATE knowledge_documents SET
          processing_status = 'failed',
          status = 'Ready',
          error_message = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(err.message || String(err), docId);

      throw err;
    }
  },

  async retryDocument(docId: string): Promise<KnowledgeDocumentDTO> {
    return this.reindexDocument(docId);
  },

  getChunks(docId: string): KnowledgeChunkDTO[] {
    const db = getDb();
    const rows = db
      .prepare(
        'SELECT * FROM knowledge_chunks WHERE document_id = ? ORDER BY chunk_index ASC'
      )
      .all(docId) as KnowledgeChunkEntity[];

    return rows.map(knowledgeChunkEntityToDto);
  },

  getConfig(): KnowledgeConfigDTO {
    const db = getDb();
    const provider = getEmbeddingProvider();

    const totalDocs = (
      db.prepare('SELECT COUNT(*) as count FROM knowledge_documents').get() as { count: number }
    ).count;

    const totalChunks = (
      db.prepare('SELECT COUNT(*) as count FROM knowledge_chunks').get() as { count: number }
    ).count;

    const totalEmbedded = (
      db
        .prepare(
          'SELECT COUNT(*) as count FROM knowledge_chunks WHERE embedding IS NOT NULL'
        )
        .get() as { count: number }
    ).count;

    return {
      aiConfigured: provider.isConfigured(),
      embeddingModel: provider.getEmbeddingModel(),
      chatModel: provider.getChatModel(),
      baseUrl: provider.getBaseUrl(),
      totalDocuments: totalDocs,
      totalChunks,
      totalEmbeddedChunks: totalEmbedded,
    };
  },

  deleteDocument(docId: string): boolean {
    const db = getDb();
    const doc = db
      .prepare('SELECT * FROM knowledge_documents WHERE id = ?')
      .get(docId) as KnowledgeDocumentEntity | undefined;

    if (!doc) return false;

    // Remove file from disk if present
    if (doc.file_path) {
      fileStorageService.deleteFile(doc.file_path).catch(() => {});
    }

    // Cascade delete chunks and document
    db.prepare('DELETE FROM knowledge_chunks WHERE document_id = ?').run(docId);
    db.prepare('DELETE FROM knowledge_documents WHERE id = ?').run(docId);

    return true;
  },
};

