import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getDb } from '../../db/database.js';
import type { KnowledgeDocumentEntity } from '../../types/index.js';

export function getUploadsDirectory(): string {
  // Support both running from project root (d:\LeadForge) and server directory (d:\LeadForge\server)
  const baseDir = fs.existsSync(path.resolve(process.cwd(), 'server'))
    ? path.resolve(process.cwd(), 'server/data/uploads')
    : path.resolve(process.cwd(), 'data/uploads');

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  return baseDir;
}

export function sanitizeFilename(filename: string): string {
  // Strip paths, control chars, null bytes, and traversal attempts
  const base = path.basename(filename);
  const sanitized = base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_');
  return sanitized.length > 0 ? sanitized : 'document';
}

export function computeSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export const fileStorageService = {
  async saveFile(
    docId: string,
    originalFilename: string,
    buffer: Buffer
  ): Promise<{ filePath: string; contentHash: string; fileSize: number; sanitizedFilename: string }> {
    const uploadDir = getUploadsDirectory();
    const sanitizedFilename = sanitizeFilename(originalFilename);
    const storedFilename = `${docId}_${sanitizedFilename}`;
    const targetPath = path.join(uploadDir, storedFilename);

    // Prevent directory traversal
    const normalizedTarget = path.normalize(targetPath);
    if (!normalizedTarget.startsWith(path.normalize(uploadDir))) {
      throw new Error('Invalid file path: path traversal detected');
    }

    await fs.promises.writeFile(normalizedTarget, buffer);

    const contentHash = computeSha256(buffer);
    const fileSize = buffer.length;

    return {
      filePath: normalizedTarget,
      contentHash,
      fileSize,
      sanitizedFilename,
    };
  },

  async readFile(filePath: string): Promise<Buffer> {
    const uploadDir = getUploadsDirectory();
    const normalized = path.normalize(filePath);
    // Ensure file is within uploads directory
    if (!normalized.startsWith(path.normalize(uploadDir)) && !fs.existsSync(normalized)) {
      throw new Error('File access outside uploads directory forbidden');
    }

    if (!fs.existsSync(normalized)) {
      throw new Error(`File not found on disk: ${path.basename(filePath)}`);
    }

    return fs.promises.readFile(normalized);
  },

  async deleteFile(filePath: string): Promise<boolean> {
    try {
      if (!filePath) return false;
      const normalized = path.normalize(filePath);
      if (fs.existsSync(normalized)) {
        await fs.promises.unlink(normalized);
        return true;
      }
      return false;
    } catch (err) {
      console.warn(`Failed to delete file from disk: ${filePath}`, err);
      return false;
    }
  },

  findDuplicate(contentHash: string, excludeId?: string): KnowledgeDocumentEntity | null {
    if (!contentHash) return null;
    const db = getDb();
    let query = 'SELECT * FROM knowledge_documents WHERE content_hash = ?';
    const params: any[] = [contentHash];

    if (excludeId) {
      query += ' AND id != ?';
      params.push(excludeId);
    }

    query += ' LIMIT 1';
    const row = db.prepare(query).get(...params) as KnowledgeDocumentEntity | undefined;
    return row || null;
  },
};

