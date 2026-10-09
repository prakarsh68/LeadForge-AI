import type { ExtractedSection } from './textExtractorService.js';

export interface ChunkItem {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  pageNumber?: number | null;
  sectionTitle?: string | null;
  charCount: number;
}

export interface ChunkingOptions {
  targetChunkSize?: number;
  chunkOverlap?: number;
  minChunkSize?: number;
}

const DEFAULT_TARGET_SIZE = 600;
const DEFAULT_OVERLAP = 100;
const DEFAULT_MIN_SIZE = 60;

function splitIntoSentences(text: string): string[] {
  // Split on sentence boundaries (. ! ?) followed by whitespace or line break
  const rawSentences = text.split(/(?<=[.?!])\s+/);
  const result: string[] = [];
  for (const s of rawSentences) {
    const trimmed = s.trim();
    if (trimmed) {
      result.push(trimmed);
    }
  }
  return result;
}

export const chunkingService = {
  createChunks(
    documentId: string,
    sections: ExtractedSection[],
    options: ChunkingOptions = {}
  ): ChunkItem[] {
    const targetSize = options.targetChunkSize ?? DEFAULT_TARGET_SIZE;
    const overlap = options.chunkOverlap ?? DEFAULT_OVERLAP;
    const minSize = options.minChunkSize ?? DEFAULT_MIN_SIZE;

    const chunks: ChunkItem[] = [];
    let globalChunkIndex = 0;

    for (const section of sections) {
      const text = section.text.trim();
      if (!text) continue;

      // If section is small enough to fit in a single chunk, keep it intact
      if (text.length <= targetSize + overlap) {
        chunks.push({
          id: `chunk-${documentId}-${globalChunkIndex}`,
          documentId,
          chunkIndex: globalChunkIndex,
          content: text,
          pageNumber: section.pageNumber ?? null,
          sectionTitle: section.sectionTitle ?? null,
          charCount: text.length,
        });
        globalChunkIndex++;
        continue;
      }

      // Split into paragraphs first
      const paragraphs = text.split(/\n\n+/).filter(Boolean);
      let currentChunkText = '';

      for (const para of paragraphs) {
        const sentences = splitIntoSentences(para);

        for (const sentence of sentences) {
          const testLength = currentChunkText
            ? currentChunkText.length + 1 + sentence.length
            : sentence.length;

          if (testLength <= targetSize) {
            currentChunkText = currentChunkText ? `${currentChunkText} ${sentence}` : sentence;
          } else {
            // If current chunk is already substantial, emit it
            if (currentChunkText.length >= minSize) {
              chunks.push({
                id: `chunk-${documentId}-${globalChunkIndex}`,
                documentId,
                chunkIndex: globalChunkIndex,
                content: currentChunkText.trim(),
                pageNumber: section.pageNumber ?? null,
                sectionTitle: section.sectionTitle ?? null,
                charCount: currentChunkText.trim().length,
              });
              globalChunkIndex++;

              // Compute overlap from end of current chunk
              if (overlap > 0 && currentChunkText.length > overlap) {
                const words = currentChunkText.split(' ');
                let overlapWords: string[] = [];
                let overlapLen = 0;
                for (let i = words.length - 1; i >= 0; i--) {
                  const w = words[i];
                  if (overlapLen + w.length + 1 <= overlap) {
                    overlapWords.unshift(w);
                    overlapLen += w.length + 1;
                  } else {
                    break;
                  }
                }
                const overlapText = overlapWords.join(' ');
                currentChunkText = overlapText ? `${overlapText} ${sentence}` : sentence;
              } else {
                currentChunkText = sentence;
              }
            } else {
              // Sentence itself might be large
              currentChunkText = currentChunkText ? `${currentChunkText} ${sentence}` : sentence;
            }
          }
        }
      }

      // Emit trailing chunk if it exists
      if (currentChunkText.trim().length >= minSize) {
        chunks.push({
          id: `chunk-${documentId}-${globalChunkIndex}`,
          documentId,
          chunkIndex: globalChunkIndex,
          content: currentChunkText.trim(),
          pageNumber: section.pageNumber ?? null,
          sectionTitle: section.sectionTitle ?? null,
          charCount: currentChunkText.trim().length,
        });
        globalChunkIndex++;
      } else if (currentChunkText.trim().length > 0 && chunks.length > 0) {
        // Append small remainder to previous chunk if safe
        const lastChunk = chunks[chunks.length - 1];
        lastChunk.content = `${lastChunk.content} ${currentChunkText.trim()}`.trim();
        lastChunk.charCount = lastChunk.content.length;
      } else if (currentChunkText.trim().length > 0) {
        chunks.push({
          id: `chunk-${documentId}-${globalChunkIndex}`,
          documentId,
          chunkIndex: globalChunkIndex,
          content: currentChunkText.trim(),
          pageNumber: section.pageNumber ?? null,
          sectionTitle: section.sectionTitle ?? null,
          charCount: currentChunkText.trim().length,
        });
        globalChunkIndex++;
      }
    }

    return chunks;
  },
};

