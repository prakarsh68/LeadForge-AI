import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createTestContext, type TestContext } from './testHelper.js';
import {
  fileStorageService,
  sanitizeFilename,
  computeSha256,
} from '../services/knowledge/fileStorageService.js';
import {
  textExtractorService,
  normalizeExtractedText,
} from '../services/knowledge/textExtractorService.js';
import { chunkingService } from '../services/knowledge/chunkingService.js';
import {
  cosineSimilarity,
  MockEmbeddingProvider,
  setEmbeddingProvider,
  resetEmbeddingProvider,
} from '../services/knowledge/embeddingProvider.js';
import { retrievalService } from '../services/knowledge/retrievalService.js';
import { ragService } from '../services/knowledge/ragService.js';
import { knowledgePipelineService } from '../services/knowledge/knowledgePipelineService.js';

describe('Phase 4: Knowledge Intelligence & RAG Pipeline', () => {
  let ctx: TestContext;
  let mockProvider: MockEmbeddingProvider;

  before(async () => {
    ctx = await createTestContext();
    mockProvider = new MockEmbeddingProvider({ dimension: 64 });
    setEmbeddingProvider(mockProvider);
  });

  after(async () => {
    resetEmbeddingProvider();
    await ctx.cleanup();
  });

  describe('Workstream 1: File Storage & Security', () => {
    it('Sanitizes filenames and prevents directory traversal', () => {
      const unsafe = '../../etc/passwd';
      const clean = sanitizeFilename(unsafe);
      assert.ok(!clean.includes('..'));
      assert.ok(!clean.includes('/'));
      assert.strictEqual(clean, 'passwd');
    });

    it('Computes consistent SHA-256 content hashes', () => {
      const buffer = Buffer.from('LeadForge Enterprise Playbook 2026', 'utf-8');
      const hash1 = computeSha256(buffer);
      const hash2 = computeSha256(buffer);
      assert.strictEqual(hash1, hash2);
      assert.strictEqual(hash1.length, 64);
    });

    it('Saves, reads, and deletes file on disk securely', async () => {
      const testBuffer = Buffer.from('Confidential pricing matrix data', 'utf-8');
      const docId = `test-doc-${Date.now()}`;
      const saved = await fileStorageService.saveFile(docId, 'matrix.txt', testBuffer);

      assert.ok(fs.existsSync(saved.filePath));
      assert.strictEqual(saved.fileSize, testBuffer.length);

      const readBuffer = await fileStorageService.readFile(saved.filePath);
      assert.strictEqual(readBuffer.toString('utf-8'), 'Confidential pricing matrix data');

      const deleted = await fileStorageService.deleteFile(saved.filePath);
      assert.strictEqual(deleted, true);
      assert.ok(!fs.existsSync(saved.filePath));
    });
  });

  describe('Workstream 2: Text Extraction & Normalization', () => {
    it('Normalizes non-printable characters and line breaks', () => {
      const raw = 'Line 1\r\n\r\n\r\nLine 2\0 with null and   spaces';
      const clean = normalizeExtractedText(raw);
      assert.ok(!clean.includes('\r'));
      assert.ok(!clean.includes('\0'));
      assert.ok(clean.includes('Line 1\n\nLine 2 with null and spaces'));
    });

    it('Extracts Markdown with headers as section titles', () => {
      const mdContent = `---
title: Ignored Frontmatter
---

# Architecture Overview
LeadForge AI autonomous architecture operates on event queues.

## Security Controls
All customer data is encrypted in transit and at rest using AES-256.
`;
      const extracted = textExtractorService.extractFromMarkdown(Buffer.from(mdContent, 'utf-8'));
      assert.ok(extracted.fullText.includes('LeadForge AI autonomous architecture'));
      assert.strictEqual(extracted.sections.length >= 2, true);
      assert.ok(extracted.sections.some((s) => s.sectionTitle === 'Architecture Overview'));
      assert.ok(extracted.sections.some((s) => s.sectionTitle === 'Security Controls'));
    });

    it('Extracts plain text and splits into logical sections', () => {
      const txt = 'Paragraph one regarding inbound sales.\n\nParagraph two on qualification tiers.';
      const extracted = textExtractorService.extractFromPlainText(Buffer.from(txt, 'utf-8'));
      assert.ok(extracted.fullText.includes('Paragraph one'));
      assert.ok(extracted.wordCount > 0);
      assert.ok(extracted.charCount > 0);
    });
  });

  describe('Workstream 3: Deterministic Chunking & Overlap', () => {
    it('Generates deterministic chunks with indices and character counts', () => {
      const sections = [
        {
          text: 'LeadForge AI enables automated lead discovery from verified enterprise data sources. It enriches contact details with corporate emails and job seniority. The platform calculates deterministic ICP qualification scores.',
          pageNumber: 1,
          sectionTitle: 'Platform Summary',
        },
      ];

      const chunks1 = chunkingService.createChunks('doc-test-1', sections, {
        targetChunkSize: 120,
        chunkOverlap: 20,
      });

      const chunks2 = chunkingService.createChunks('doc-test-1', sections, {
        targetChunkSize: 120,
        chunkOverlap: 20,
      });

      assert.strictEqual(chunks1.length, chunks2.length);
      assert.strictEqual(chunks1[0].id, 'chunk-doc-test-1-0');
      assert.strictEqual(chunks1[0].content, chunks2[0].content);
      assert.strictEqual(chunks1[0].pageNumber, 1);
      assert.strictEqual(chunks1[0].sectionTitle, 'Platform Summary');
    });

    it('Handles small content without unnecessary fragmentation', () => {
      const sections = [{ text: 'Short snippet under target size.', sectionTitle: 'Overview' }];
      const chunks = chunkingService.createChunks('doc-small', sections, {
        targetChunkSize: 500,
        chunkOverlap: 50,
      });
      assert.strictEqual(chunks.length, 1);
      assert.strictEqual(chunks[0].content, 'Short snippet under target size.');
    });
  });

  describe('Workstream 4: Vector Embeddings & Cosine Similarity', () => {
    it('Calculates cosine similarity mathematically accurately', () => {
      const vA = [1, 0, 0];
      const vB = [1, 0, 0];
      const vC = [0, 1, 0];
      const vD = [-1, 0, 0];

      // Identical vectors -> 1.0
      assert.strictEqual(Math.round(cosineSimilarity(vA, vB)), 1);
      // Orthogonal vectors -> 0.0
      assert.strictEqual(cosineSimilarity(vA, vC), 0);
      // Opposite vectors -> -1.0
      assert.strictEqual(Math.round(cosineSimilarity(vA, vD)), -1);
    });

    it('Handles edge cases in cosine similarity safely (empty or zero vectors)', () => {
      assert.strictEqual(cosineSimilarity([], []), 0);
      assert.strictEqual(cosineSimilarity([0, 0], [0, 0]), 0);
      assert.strictEqual(cosineSimilarity([1, 2], [1]), 0);
    });

    it('MockEmbeddingProvider produces high similarity for related texts and low for unrelated', async () => {
      const provider = new MockEmbeddingProvider({ dimension: 64 });
      const [vecRev1, vecRev2, vecCyber] = await provider.generateEmbeddings([
        'Lead revenue acceleration and automated SDR sales pipeline',
        'Sales pipeline acceleration and SDR revenue automation',
        'Quantum cryptography kernel compilation for microcontrollers',
      ]);

      const simRelated = cosineSimilarity(vecRev1, vecRev2);
      const simUnrelated = cosineSimilarity(vecRev1, vecCyber);

      assert.ok(
        simRelated > simUnrelated,
        `Expected related similarity (${simRelated}) to be higher than unrelated (${simUnrelated})`
      );
      assert.ok(simRelated > 0.5, `Expected related similarity > 0.5, got ${simRelated}`);
    });
  });

  describe('Workstream 5: Semantic Retrieval & Keyword Fallback', () => {
    it('Performs semantic search across indexed chunks', async () => {
      const results = await retrievalService.search('pricing enterprise cost discount', {
        limit: 3,
      });

      assert.ok(results.length > 0);
      assert.ok(results[0].similarityScore > 0);
      assert.ok(results[0].chunkId.length > 0);
      assert.ok(results[0].documentTitle.length > 0);
    });

    it('Falls back to keyword search when AI provider is unconfigured', async () => {
      // Temporarily mock unconfigured provider
      setEmbeddingProvider({
        isConfigured: () => false,
        getEmbeddingModel: () => 'none',
        getChatModel: () => 'none',
        getBaseUrl: () => 'none',
        generateEmbeddings: async () => [],
        generateChatCompletion: async () => '',
      });

      const results = await retrievalService.search('HubSpot Salesforce compliance', {
        limit: 3,
      });

      assert.ok(results.length > 0);
      assert.strictEqual(results[0].searchMode, 'keyword');
      assert.ok(
        results[0].content.toLowerCase().includes('hubspot') ||
          results[0].content.toLowerCase().includes('salesforce')
      );

      // Restore mock provider
      setEmbeddingProvider(mockProvider);
    });

    it('Filters search results by category', async () => {
      const results = await retrievalService.search('enterprise subscription', {
        category: 'Pricing',
        limit: 5,
      });

      for (const r of results) {
        assert.strictEqual(r.category, 'Pricing');
      }
    });
  });

  describe('Workstream 6: Grounded RAG Q&A & Citation Validation', () => {
    it('Answers questions with grounded citations when AI is configured', async () => {
      setEmbeddingProvider(mockProvider);

      const response = await ragService.ask('What are the enterprise pricing tiers and features?', {
        category: 'Pricing',
      });

      assert.strictEqual(response.isAiConfigured, true);
      assert.ok(response.answer.length > 0);
      assert.ok(response.citations.length > 0);
      assert.ok(response.citations[0].chunkId.startsWith('chunk-'));
      assert.ok(response.citations[0].documentTitle.length > 0);
    });

    it('Returns honest insufficient evidence when query has no matching collateral', async () => {
      const response = await ragService.ask(
        'What is the velocity of an unladen swallow in subzero planetary orbit?'
      );

      assert.ok(response.answer.toLowerCase().includes('insufficient evidence'));
      assert.strictEqual(response.citations.length, 0);
      assert.strictEqual(response.confidence, 0);
    });

    it('Provides honest keyword match synthesis when AI provider is unconfigured', async () => {
      setEmbeddingProvider({
        isConfigured: () => false,
        getEmbeddingModel: () => 'none',
        getChatModel: () => 'none',
        getBaseUrl: () => 'none',
        generateEmbeddings: async () => [],
        generateChatCompletion: async () => '',
      });

      const response = await ragService.ask('What compliance standards does LeadForge adhere to?');

      assert.strictEqual(response.isAiConfigured, false);
      assert.strictEqual(response.searchMode, 'keyword');
      assert.ok(response.answer.includes('AI generation is not configured'));
      assert.ok(response.citations.length > 0);

      // Restore mock provider
      setEmbeddingProvider(mockProvider);
    });
  });

  describe('Workstream 7: End-to-End Pipeline Ingestion & Re-indexing', () => {
    let ingestedDocId: string;

    it('Ingests Markdown file, creates chunks, and generates embeddings', async () => {
      const mdBuffer = Buffer.from(
        `# Objection Handling Battlecard
When prospects raise data privacy concerns, emphasize SOC2 Type II compliance and European GDPR residency options.
LeadForge encrypts all enriched candidate identities in SQLite vaults with AES-256 field hashing.

# Competitive Differentiation
Unlike ZoomInfo or Apollo, LeadForge evaluates real buying triggers directly against custom Ideal Customer Profiles.`,
        'utf-8'
      );

      const ingested = await knowledgePipelineService.ingestFile({
        fileBuffer: mdBuffer,
        originalName: 'battlecard_objections.md',
        title: 'Q1 Competitive Battlecard & Privacy Objection Handling',
        category: 'Battlecards',
        summary: 'Objection response guidelines for privacy and data residency.',
        mimeType: 'text/markdown',
      });

      assert.ok(ingested.id);
      assert.strictEqual(ingested.category, 'Battlecards');
      assert.strictEqual(ingested.type, 'md');
      assert.strictEqual(ingested.processingStatus, 'indexed');
      assert.strictEqual(ingested.status, 'Indexed');
      assert.ok((ingested.chunkCount || 0) >= 2);

      ingestedDocId = ingested.id;
    });

    it('Retrieves chunk items for the newly ingested document', () => {
      const chunks = knowledgePipelineService.getChunks(ingestedDocId);
      assert.ok(chunks.length >= 2);
      assert.strictEqual(chunks[0].documentId, ingestedDocId);
      assert.strictEqual(chunks[0].hasEmbedding, true);
    });

    it('Re-indexes the document and maintains chunk integrity', async () => {
      const reindexed = await knowledgePipelineService.reindexDocument(ingestedDocId);
      assert.strictEqual(reindexed.id, ingestedDocId);
      assert.strictEqual(reindexed.processingStatus, 'indexed');

      const chunksAfter = knowledgePipelineService.getChunks(ingestedDocId);
      assert.ok(chunksAfter.length >= 2);
    });

    it('Returns telemetry in getConfig()', () => {
      const config = knowledgePipelineService.getConfig();
      assert.strictEqual(typeof config.aiConfigured, 'boolean');
      assert.ok(config.totalDocuments >= 3);
      assert.ok(config.totalChunks >= 6);
      assert.ok(config.totalEmbeddedChunks >= 2);
    });

    it('Cascades deletion cleanly unlinking chunks', () => {
      const deleted = knowledgePipelineService.deleteDocument(ingestedDocId);
      assert.strictEqual(deleted, true);

      const chunksRemaining = knowledgePipelineService.getChunks(ingestedDocId);
      assert.strictEqual(chunksRemaining.length, 0);
    });
  });

  describe('Workstream 8: HTTP REST Endpoints', () => {
    it('GET /api/knowledge/config returns provider and corpus statistics', async () => {
      const res = await ctx.request('/api/knowledge/config');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(typeof res.body.data.aiConfigured, 'boolean');
      assert.ok(res.body.data.totalDocuments >= 2);
    });

    it('POST /api/knowledge/search handles query and returns matching chunks', async () => {
      const res = await ctx.request('/api/knowledge/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'LeadForge enterprise CRM sync', limit: 2 }),
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length > 0);
    });

    it('POST /api/knowledge/ask answers grounded questions', async () => {
      setEmbeddingProvider(mockProvider);
      const res = await ctx.request('/api/knowledge/ask', {
        method: 'POST',
        body: JSON.stringify({ question: 'What is the pricing model for enterprise?' }),
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.answer.length > 0);
      assert.ok(Array.isArray(res.body.data.citations));
    });

    it('GET /api/knowledge/documents/:id/chunks returns chunks for document', async () => {
      const res = await ctx.request('/api/knowledge/documents/doc-1/chunks');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.strictEqual(res.body.data.length, 3);
      assert.strictEqual(res.body.data[0].documentId, 'doc-1');
    });

    it('POST /api/knowledge/documents/:id/reindex triggers re-indexing', async () => {
      const res = await ctx.request('/api/knowledge/documents/doc-1/reindex', {
        method: 'POST',
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.id, 'doc-1');
    });
  });
});

