import type { PrefixMode } from "./embedder";

export interface QueryEmbeddingCache {
  get(query: string): number[] | undefined;
  set(query: string, vector: number[]): void;
}

export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLowerCase();
}

export function createQueryEmbeddingCache(options: { maxEntries: number; prefixMode: PrefixMode }): QueryEmbeddingCache {
  const entries = new Map<string, number[]>();
  const key = (query: string) => `${options.prefixMode}:${normalizeQuery(query)}`;
  return {
    get(query) {
      const cacheKey = key(query);
      const vector = entries.get(cacheKey);
      if (vector === undefined) return undefined;
      entries.delete(cacheKey);
      entries.set(cacheKey, vector);
      return vector;
    },
    set(query, vector) {
      const cacheKey = key(query);
      entries.delete(cacheKey);
      entries.set(cacheKey, vector);
      while (entries.size > options.maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
    },
  };
}
