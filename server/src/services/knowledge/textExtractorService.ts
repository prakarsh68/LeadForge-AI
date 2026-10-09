import path from 'node:path';

export interface ExtractedSection {
  text: string;
  pageNumber?: number | null;
  sectionTitle?: string | null;
}

export interface ExtractedDocument {
  fullText: string;
  sections: ExtractedSection[];
  wordCount: number;
  charCount: number;
}

export function normalizeExtractedText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\0/g, '') // strip null bytes
    .replace(/\r\n/g, '\n') // normalize carriage returns
    .replace(/\r/g, '\n')
    // oxlint-disable-next-line eslint(no-control-regex)
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // remove non-printable control characters
    .replace(/[ \t]+/g, ' ') // collapse multiple horizontal spaces
    .replace(/\n{3,}/g, '\n\n') // collapse excess blank lines
    .trim();
}

export const textExtractorService = {
  async extractText(
    buffer: Buffer,
    filename: string,
    mimeType?: string
  ): Promise<ExtractedDocument> {
    const ext = path.extname(filename).toLowerCase();

    if (ext === '.pdf' || mimeType === 'application/pdf') {
      return this.extractFromPdf(buffer);
    }

    if (
      ext === '.docx' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      return this.extractFromDocx(buffer);
    }

    if (ext === '.md' || ext === '.markdown' || mimeType === 'text/markdown') {
      return this.extractFromMarkdown(buffer);
    }

    // Default to plain text for .txt and any other text file
    return this.extractFromPlainText(buffer);
  },

  async extractFromPdf(buffer: Buffer): Promise<ExtractedDocument> {
    try {
      const pdfModule = await import('pdf-parse');
      const PDFParse = (pdfModule as any).PDFParse || (pdfModule as any).default?.PDFParse;

      if (PDFParse) {
        const parser = new PDFParse({ data: buffer });
        const res = await parser.getText();
        const sections: ExtractedSection[] = [];
        let fullText = '';

        if (Array.isArray(res.pages) && res.pages.length > 0) {
          for (const page of res.pages) {
            const cleanText = normalizeExtractedText(page.text || '');
            if (cleanText) {
              sections.push({
                text: cleanText,
                pageNumber: page.num,
                sectionTitle: `Page ${page.num}`,
              });
              fullText += (fullText ? '\n\n' : '') + cleanText;
            }
          }
        } else if (res.text) {
          const cleanText = normalizeExtractedText(res.text);
          sections.push({
            text: cleanText,
            pageNumber: 1,
            sectionTitle: 'Document Content',
          });
          fullText = cleanText;
        }

        const charCount = fullText.length;
        const wordCount = fullText ? fullText.split(/\s+/).filter(Boolean).length : 0;

        return { fullText, sections, wordCount, charCount };
      }

      // Fallback if PDFParse class not available
      const cleanText = normalizeExtractedText(buffer.toString('utf-8'));
      return {
        fullText: cleanText,
        sections: [{ text: cleanText, pageNumber: 1 }],
        wordCount: cleanText.split(/\s+/).filter(Boolean).length,
        charCount: cleanText.length,
      };
    } catch (err: any) {
      throw new Error(`Failed to extract text from PDF: ${err.message || String(err)}`);
    }
  },

  async extractFromDocx(buffer: Buffer): Promise<ExtractedDocument> {
    try {
      const mammothModule = await import('mammoth');
      const mammoth = (mammothModule as any).default || mammothModule;
      const res = await mammoth.extractRawText({ buffer });
      const normalized = normalizeExtractedText(res.value || '');

      // Split into logical sections by double newlines or heading-like lines
      const rawParagraphs = normalized.split(/\n\n+/).filter(Boolean);
      const sections: ExtractedSection[] = [];
      let currentSectionTitle = 'General';
      let currentSectionText: string[] = [];

      for (const p of rawParagraphs) {
        const trimmed = p.trim();
        // Check if paragraph is short and looks like a header (under 80 chars, no ending period)
        if (trimmed.length < 80 && !trimmed.endsWith('.') && trimmed.length > 3) {
          if (currentSectionText.length > 0) {
            sections.push({
              text: currentSectionText.join('\n\n'),
              sectionTitle: currentSectionTitle,
            });
            currentSectionText = [];
          }
          currentSectionTitle = trimmed;
        } else {
          currentSectionText.push(trimmed);
        }
      }

      if (currentSectionText.length > 0) {
        sections.push({
          text: currentSectionText.join('\n\n'),
          sectionTitle: currentSectionTitle,
        });
      }

      if (sections.length === 0 && normalized) {
        sections.push({ text: normalized, sectionTitle: 'Document Content' });
      }

      const charCount = normalized.length;
      const wordCount = normalized ? normalized.split(/\s+/).filter(Boolean).length : 0;

      return { fullText: normalized, sections, wordCount, charCount };
    } catch (err: any) {
      throw new Error(`Failed to extract text from DOCX: ${err.message || String(err)}`);
    }
  },

  extractFromMarkdown(buffer: Buffer): ExtractedDocument {
    let raw = buffer.toString('utf-8');

    // Strip YAML frontmatter if present (between leading --- and ---)
    raw = raw.replace(/^---[\r\n]+[\s\S]*?[\r\n]+---[\r\n]*/, '');

    const normalized = normalizeExtractedText(raw);
    const lines = normalized.split('\n');
    const sections: ExtractedSection[] = [];

    let currentTitle = 'Introduction';
    let currentLines: string[] = [];

    for (const line of lines) {
      const headingMatch = line.match(/^#{1,4}\s+(.+)$/);
      if (headingMatch) {
        if (currentLines.length > 0) {
          const text = currentLines.join('\n').trim();
          if (text) {
            sections.push({ text, sectionTitle: currentTitle });
          }
          currentLines = [];
        }
        currentTitle = headingMatch[1].trim();
      } else {
        currentLines.push(line);
      }
    }

    if (currentLines.length > 0) {
      const text = currentLines.join('\n').trim();
      if (text) {
        sections.push({ text, sectionTitle: currentTitle });
      }
    }

    if (sections.length === 0 && normalized) {
      sections.push({ text: normalized, sectionTitle: 'Overview' });
    }

    const charCount = normalized.length;
    const wordCount = normalized ? normalized.split(/\s+/).filter(Boolean).length : 0;

    return { fullText: normalized, sections, wordCount, charCount };
  },

  extractFromPlainText(buffer: Buffer): ExtractedDocument {
    const raw = buffer.toString('utf-8');
    const normalized = normalizeExtractedText(raw);

    // Split on paragraphs
    const paragraphs = normalized.split(/\n\n+/).filter(Boolean);
    const sections: ExtractedSection[] = [];

    if (paragraphs.length > 0) {
      let currentSectionText: string[] = [];
      let currentSectionTitle = 'Section 1';
      let sectionIdx = 1;

      for (const p of paragraphs) {
        currentSectionText.push(p);
        if (currentSectionText.join('\n\n').length >= 1000) {
          sections.push({
            text: currentSectionText.join('\n\n'),
            sectionTitle: currentSectionTitle,
          });
          sectionIdx++;
          currentSectionTitle = `Section ${sectionIdx}`;
          currentSectionText = [];
        }
      }

      if (currentSectionText.length > 0) {
        sections.push({
          text: currentSectionText.join('\n\n'),
          sectionTitle: currentSectionTitle,
        });
      }
    } else if (normalized) {
      sections.push({ text: normalized, sectionTitle: 'Content' });
    }

    const charCount = normalized.length;
    const wordCount = normalized ? normalized.split(/\s+/).filter(Boolean).length : 0;

    return { fullText: normalized, sections, wordCount, charCount };
  },
};
