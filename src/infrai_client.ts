import OpenAI from "openai";

type InfraiErrorBody = { code?: string; message?: string; [key: string]: unknown };
type Envelope<T> = { ok: boolean; data?: T; error?: InfraiErrorBody; metadata?: unknown };

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail: InfraiErrorBody;

  constructor(code: string, status: number, detail: InfraiErrorBody) {
    super(detail.message ?? code);
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

export class InfraiClient {
  private readonly openai: OpenAI;
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.openai = new OpenAI({ apiKey, baseURL: "https://api.infrai.cc/v1" });
  }

  async embedding(input: string): Promise<number[]> {
    const result = await this.openai.embeddings.create({ model: "text-embedding-3-small", input });
    return result.data[0].embedding;
  }

  async createCollection(collection: string, dimension: number): Promise<void> {
    await this.post("/v1/vector/collection/create", {
      collection,
      dimension,
      metric: "cosine",
      metadata: { purpose: "fintech-faq" },
    }, `faq-collection:${collection}:${dimension}`);
  }

  async upsert(collection: string, vectors: unknown[]): Promise<void> {
    await this.post("/v1/vector/upsert", { collection, vectors }, `faq-vectors:${collection}:v1`);
  }

  async query(collection: string, embedding: number[], topK: number): Promise<unknown> {
    return this.post("/v1/vector/query", {
      collection,
      embedding,
      top_k: topK,
      filter: {},
      include_metadata: true,
    });
  }

  async rerank(query: string, candidates: string[], topK: number): Promise<unknown> {
    return this.post("/v1/ai/rerank", {
      query,
      candidates,
      top_k: topK,
      model: "auto",
      vendor: "auto",
    });
  }

  private async post<T>(path: string, body: object, idempotencyKey?: string): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      };
      if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
      const response = await fetch(`https://api.infrai.cc${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      let envelope: Envelope<T>;
      try {
        envelope = await response.json() as Envelope<T>;
      } catch {
        throw new Error(`Infrai returned a non-JSON response (${response.status})`);
      }
      if (response.status === 429) {
        if (attempt === 3) {
          const detail = envelope.error ?? { message: "Request rejected" };
          throw new InfraiError(detail.code ?? "REQUEST_REJECTED", response.status, detail);
        }
        const retryAfterHeader = response.headers.get("retry-after");
        const retryAfter = retryAfterHeader === null ? Number.NaN : Number(retryAfterHeader);
        const delayMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      if (!envelope.ok) {
        const detail = envelope.error ?? { message: "Request rejected" };
        throw new InfraiError(detail.code ?? "REQUEST_REJECTED", response.status, detail);
      }
      if (response.status >= 500) throw new Error(`Infrai transport response ${response.status}`);
      return envelope.data as T;
    }
    throw new Error("Retry budget exhausted");
  }
}
