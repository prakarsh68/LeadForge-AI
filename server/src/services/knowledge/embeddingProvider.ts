export interface IEmbeddingProvider {
  isConfigured(): boolean;
  getEmbeddingModel(): string;
  getChatModel(): string;
  getBaseUrl(): string;
  generateEmbeddings(texts: string[]): Promise<number[][]>;
  generateChatCompletion(messages: Array<{ role: string; content: string }>): Promise<string>;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  const sim = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.max(-1, Math.min(1, sim));
}

export class OpenAiEmbeddingProvider implements IEmbeddingProvider {
  private apiKey: string;
  private baseUrl: string;
  private embeddingModel: string;
  private chatModel: string;

  constructor(options?: {
    apiKey?: string;
    baseUrl?: string;
    embeddingModel?: string;
    chatModel?: string;
  }) {
    this.apiKey = options?.apiKey ?? process.env.KNOWLEDGE_AI_API_KEY ?? '';
    this.baseUrl = (
      options?.baseUrl ??
      process.env.KNOWLEDGE_AI_BASE_URL ??
      'https://api.openai.com/v1'
    ).replace(/\/+$/, '');
    this.embeddingModel =
      options?.embeddingModel ??
      process.env.KNOWLEDGE_EMBEDDING_MODEL ??
      'text-embedding-3-small';
    this.chatModel =
      options?.chatModel ?? process.env.KNOWLEDGE_CHAT_MODEL ?? 'gpt-4o-mini';
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  getEmbeddingModel(): string {
    return this.embeddingModel;
  }

  getChatModel(): string {
    return this.chatModel;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.isConfigured()) {
      throw new Error(
        'AI embedding provider is not configured. Missing KNOWLEDGE_AI_API_KEY.'
      );
    }

    if (texts.length === 0) return [];

    const url = `${this.baseUrl}/embeddings`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        input: texts,
        model: this.embeddingModel,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Embedding API error (${response.status}): ${errText}`);
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[]; index: number }>;
    };

    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('Invalid response structure from embeddings API');
    }

    // Sort by index to guarantee ordering matches inputs
    return data.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  }

  async generateChatCompletion(
    messages: Array<{ role: string; content: string }>
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error(
        'AI chat provider is not configured. Missing KNOWLEDGE_AI_API_KEY.'
      );
    }

    const url = `${this.baseUrl}/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.chatModel,
        messages,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Chat API error (${response.status}): ${errText}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    if (!data.choices || data.choices.length === 0) {
      throw new Error('Empty response from chat completion API');
    }

    return data.choices[0].message.content || '';
  }
}

/**
 * Deterministic Mock Provider for offline testing and verification.
 * Generates reproducible L2-normalized vectors based on token hashes.
 */
export class MockEmbeddingProvider implements IEmbeddingProvider {
  private dimension: number;
  private embeddingModel: string;
  private chatModel: string;

  constructor(options?: { dimension?: number; embeddingModel?: string; chatModel?: string }) {
    this.dimension = options?.dimension ?? 64;
    this.embeddingModel = options?.embeddingModel ?? 'mock-text-embedding-v1';
    this.chatModel = options?.chatModel ?? 'mock-gpt-4o-mini';
  }

  isConfigured(): boolean {
    return true;
  }

  getEmbeddingModel(): string {
    return this.embeddingModel;
  }

  getChatModel(): string {
    return this.chatModel;
  }

  getBaseUrl(): string {
    return 'http://mock-ai.local';
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.generateDeterministicVector(text));
  }

  async generateChatCompletion(
    messages: Array<{ role: string; content: string }>
  ): Promise<string> {
    const userMessage = messages.find((m) => m.role === 'user')?.content || '';

    // Extract chunk IDs from the prompt context
    const chunkIdMatches = userMessage.match(/\[Chunk ID:\s*(chunk-[^\]]+)\]/g) || [];
    const chunkIds = chunkIdMatches.map((m) =>
      m.replace(/\[Chunk ID:\s*/, '').replace(/\]/, '').trim()
    );

    if (chunkIds.length === 0) {
      return 'Insufficient evidence found in the knowledge base to answer this question.';
    }

    // Build grounded answer citing the first available chunk
    const primaryChunk = chunkIds[0];
    return `Based on the provided documentation, LeadForge AI satisfies your requirements [${primaryChunk}]. Additional details are confirmed in the verified playbooks.`;
  }

  private generateDeterministicVector(text: string): number[] {
    const vector = new Array(this.dimension).fill(0);
    const tokens = text.toLowerCase().match(/\b[a-z0-9]{2,}\b/g) || ['empty'];

    for (const token of tokens) {
      let hash = 0;
      for (let i = 0; i < token.length; i++) {
        hash = (hash << 5) - hash + token.charCodeAt(i);
        hash |= 0;
      }
      const index = Math.abs(hash) % this.dimension;
      const weight = 1 + (Math.abs(hash >> 3) % 5);
      vector[index] += weight;
    }

    // L2 normalize
    let sumSq = 0;
    for (let i = 0; i < this.dimension; i++) {
      sumSq += vector[i] * vector[i];
    }
    const norm = Math.sqrt(sumSq) || 1;
    for (let i = 0; i < this.dimension; i++) {
      vector[i] = parseFloat((vector[i] / norm).toFixed(6));
    }

    return vector;
  }
}

// Global active provider
let activeProvider: IEmbeddingProvider = new OpenAiEmbeddingProvider();

export function getEmbeddingProvider(): IEmbeddingProvider {
  return activeProvider;
}

export function setEmbeddingProvider(provider: IEmbeddingProvider): void {
  activeProvider = provider;
}

export function resetEmbeddingProvider(): void {
  activeProvider = new OpenAiEmbeddingProvider();
}

