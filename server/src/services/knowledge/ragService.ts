import type { KnowledgeAskResult, KnowledgeCitation } from '../../types/index.js';
import { getEmbeddingProvider } from './embeddingProvider.js';
import { retrievalService } from './retrievalService.js';

export interface RagAskOptions {
  category?: string;
  topK?: number;
  minSimilarity?: number;
}

export const ragService = {
  async ask(question: string, options: RagAskOptions = {}): Promise<KnowledgeAskResult> {
    const cleanQuestion = question.trim();
    if (!cleanQuestion) {
      return {
        answer: 'Please provide a question to search your knowledge base.',
        citations: [],
        confidence: 0,
        searchMode: 'keyword',
        isAiConfigured: false,
        retrievedCount: 0,
      };
    }

    const topK = options.topK ?? 4;
    const provider = getEmbeddingProvider();
    const isAiConfigured = provider.isConfigured();

    // 1. Retrieve candidate chunks
    const retrievedChunks = await retrievalService.search(cleanQuestion, {
      category: options.category,
      limit: topK,
      minSimilarity: options.minSimilarity ?? 0.2,
    });

    // 2. Insufficient evidence check
    if (retrievedChunks.length === 0 || retrievedChunks[0].similarityScore < 0.2) {
      return {
        answer:
          'Insufficient evidence found in the knowledge base to answer this question. Please upload relevant sales collateral, battlecards, or product specifications.',
        citations: [],
        confidence: 0,
        searchMode: retrievedChunks[0]?.searchMode || (isAiConfigured ? 'semantic' : 'keyword'),
        isAiConfigured,
        retrievedCount: retrievedChunks.length,
      };
    }

    const searchMode = retrievedChunks[0].searchMode;

    // 3. If AI is not configured, provide honest keyword synthesis
    if (!isAiConfigured) {
      const citations: KnowledgeCitation[] = retrievedChunks.map((chunk) => ({
        chunkId: chunk.chunkId,
        documentId: chunk.documentId,
        documentTitle: chunk.documentTitle,
        category: chunk.category,
        pageNumber: chunk.pageNumber,
        sectionTitle: chunk.sectionTitle,
        excerpt:
          chunk.content.length > 200
            ? `${chunk.content.substring(0, 200)}...`
            : chunk.content,
        similarityScore: chunk.similarityScore,
      }));

      const topSnippets = retrievedChunks
        .slice(0, 3)
        .map(
          (c, idx) =>
            `${idx + 1}. [${c.documentTitle}${c.pageNumber ? ` p.${c.pageNumber}` : ''}]: "${c.content.substring(0, 220)}..."`
        )
        .join('\n\n');

      const answer = `[Keyword Match Synthesis]\n\nAI generation is not configured (missing KNOWLEDGE_AI_API_KEY). Below are the most relevant document passages found in your knowledge base:\n\n${topSnippets}`;

      return {
        answer,
        citations,
        confidence: retrievedChunks[0].similarityScore,
        searchMode: 'keyword',
        isAiConfigured: false,
        retrievedCount: retrievedChunks.length,
      };
    }

    // 4. AI is configured: Assemble grounded RAG context with citations
    const chunkMap = new Map(retrievedChunks.map((c) => [c.chunkId, c]));

    const contextBlocks = retrievedChunks.map((chunk) => {
      const pageInfo = chunk.pageNumber ? `Page: ${chunk.pageNumber}` : '';
      const sectionInfo = chunk.sectionTitle ? `Section: "${chunk.sectionTitle}"` : '';
      const meta = [pageInfo, sectionInfo].filter(Boolean).join(', ');
      return `[Chunk ID: ${chunk.chunkId}]\nDocument: "${chunk.documentTitle}" (${chunk.category}${meta ? `, ${meta}` : ''})\nExcerpt:\n${chunk.content}`;
    });

    const systemPrompt = `You are the LeadForge Knowledge Intelligence Assistant.
Answer the user's question accurately and objectively using ONLY the provided document excerpts.
RULES:
1. Ground every claim strictly in the context excerpts provided. Do NOT extrapolate or assume facts not present.
2. For EVERY statement or fact you state, you MUST cite the source chunk ID in square brackets, e.g. [${retrievedChunks[0].chunkId}].
3. If the excerpts do not contain enough evidence to answer the question, state: "Insufficient evidence in the knowledge base to answer this question."
4. Never invent or hallucinate chunk IDs. Only cite chunk IDs that appear in the context.`;

    const userPrompt = `CONTEXT EXCERPTS:
---
${contextBlocks.join('\n---\n')}
---

QUESTION:
${cleanQuestion}

Please provide a grounded answer with inline chunk citations.`;

    try {
      const rawAnswer = await provider.generateChatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);

      // 5. Parse and validate citations
      const citationRegex = /\[(chunk-[a-zA-Z0-9_-]+)\]/g;
      const matchedIds = new Set<string>();
      let match: RegExpExecArray | null;

      while ((match = citationRegex.exec(rawAnswer)) !== null) {
        matchedIds.add(match[1]);
      }

      const validCitations: KnowledgeCitation[] = [];
      for (const id of matchedIds) {
        const chunk = chunkMap.get(id);
        if (chunk) {
          validCitations.push({
            chunkId: chunk.chunkId,
            documentId: chunk.documentId,
            documentTitle: chunk.documentTitle,
            category: chunk.category,
            pageNumber: chunk.pageNumber,
            sectionTitle: chunk.sectionTitle,
            excerpt:
              chunk.content.length > 200
                ? `${chunk.content.substring(0, 200)}...`
                : chunk.content,
            similarityScore: chunk.similarityScore,
          });
        }
      }

      // If LLM did not include citations in brackets but gave an answer, attach top retrieved chunk as citation
      if (validCitations.length === 0 && retrievedChunks.length > 0 && !rawAnswer.includes('Insufficient evidence')) {
        const top = retrievedChunks[0];
        validCitations.push({
          chunkId: top.chunkId,
          documentId: top.documentId,
          documentTitle: top.documentTitle,
          category: top.category,
          pageNumber: top.pageNumber,
          sectionTitle: top.sectionTitle,
          excerpt:
            top.content.length > 200
              ? `${top.content.substring(0, 200)}...`
              : top.content,
          similarityScore: top.similarityScore,
        });
      }

      const baseScore = retrievedChunks[0]?.similarityScore || 0.5;
      const confidence = parseFloat(Math.min(0.99, baseScore * (validCitations.length > 0 ? 1 : 0.8)).toFixed(3));

      return {
        answer: rawAnswer.trim(),
        citations: validCitations,
        confidence,
        searchMode,
        model: provider.getChatModel(),
        isAiConfigured: true,
        retrievedCount: retrievedChunks.length,
      };
    } catch (err: any) {
      console.warn('RAG completion error, falling back to keyword summary:', err);
      return {
        answer: `Encountered error during LLM generation (${err.message || String(err)}). Showing retrieved evidence:\n\n${retrievedChunks[0].content}`,
        citations: [
          {
            chunkId: retrievedChunks[0].chunkId,
            documentId: retrievedChunks[0].documentId,
            documentTitle: retrievedChunks[0].documentTitle,
            category: retrievedChunks[0].category,
            pageNumber: retrievedChunks[0].pageNumber,
            sectionTitle: retrievedChunks[0].sectionTitle,
            excerpt: retrievedChunks[0].content.substring(0, 200),
            similarityScore: retrievedChunks[0].similarityScore,
          },
        ],
        confidence: retrievedChunks[0].similarityScore,
        searchMode: 'keyword',
        isAiConfigured: true,
        retrievedCount: retrievedChunks.length,
      };
    }
  },
};

