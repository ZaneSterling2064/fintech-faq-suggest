import type { AuditNotification, FaqEntry, FaqMatch } from "./faq_types.ts";
import type { InfraiClient } from "./infrai_client.ts";

type VectorHit = { id?: string; score?: number; metadata?: Partial<FaqEntry> };
type VectorResult = { matches?: VectorHit[]; vectors?: VectorHit[] };
type RerankItem = { index?: number };
type RerankResult = { results?: RerankItem[]; items?: RerankItem[] };

export type SuggestionResult = {
  suggestions: FaqMatch[];
  notifications: AuditNotification[];
};

export function buildNotification(query: string, match: FaqMatch, now: string): AuditNotification {
  return {
    event: "faq_suggestion_shown",
    query,
    faqId: match.id,
    action: match.action,
    requiresConfirmation: match.risk === "high",
    recordedAt: now,
  };
}

export class FaqSuggestionService {
  private readonly client: InfraiClient;
  private readonly collection: string;
  private readonly clock: () => string;

  constructor(
    client: InfraiClient,
    collection: string,
    clock = () => new Date().toISOString(),
  ) {
    this.client = client;
    this.collection = collection;
    this.clock = clock;
  }

  async suggest(query: string, limit: number): Promise<SuggestionResult> {
    const embedding = await this.client.embedding(query);
    const raw = await this.client.query(this.collection, embedding, Math.min(limit * 3, 20)) as VectorResult;
    const hits = raw.matches ?? raw.vectors ?? [];
    const matches = hits.flatMap((hit): FaqMatch[] => {
      const item = hit.metadata;
      if (!item?.question || !item.answer || !item.action || !item.risk) return [];
      return [{ id: item.id ?? hit.id ?? item.question, question: item.question, answer: item.answer,
        action: item.action, risk: item.risk, score: hit.score }];
    });
    if (matches.length === 0) return { suggestions: [], notifications: [] };

    const reranked = await this.client.rerank(query, matches.map((item) => item.question), limit) as RerankResult;
    const order = reranked.results ?? reranked.items ?? [];
    const suggestions = order.flatMap((item) => item.index === undefined ? [] : [matches[item.index]])
      .filter((item): item is FaqMatch => Boolean(item)).slice(0, limit);
    const selected = suggestions.length > 0 ? suggestions : matches.slice(0, limit);
    return {
      suggestions: selected,
      notifications: selected.map((match) => buildNotification(query, match, this.clock())),
    };
  }
}
