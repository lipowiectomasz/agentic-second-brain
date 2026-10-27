import type { Client } from "node-appwrite";
import { AppwriteException, Embeddings, EmbeddingModel } from "node-appwrite";
import { embeddingDimension } from "@cortex/core";
import { withTimeout } from "@cortex/server-kit";
import { KnowledgeError } from "./types";

export type PrefixMode = "none" | "nomic";

export interface EmbeddingItem {
  title: string;
  heading: string;
  text: string;
}

export interface Embedder {
  embedDocuments(items: EmbeddingItem[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}

export interface EmbedderOptions {
  prefixMode: PrefixMode;
  batchSize: number;
  concurrency: number;
  timeoutMs: number;
}

export const defaultEmbedderOptions: EmbedderOptions = { prefixMode: "none", batchSize: 16, concurrency: 2, timeoutMs: 60_000 };

const retryDelaysMs = [500, 1500];

export function documentText(item: EmbeddingItem, prefixMode: PrefixMode): string {
  const text = `${item.title}\n${item.heading}\n\n${item.text}`;
  return prefixMode === "nomic" ? `search_document: ${text}` : text;
}

export function queryText(text: string, prefixMode: PrefixMode): string {
  return prefixMode === "nomic" ? `search_query: ${text}` : text;
}

function retryable(error: unknown): boolean {
  if (error instanceof AppwriteException) return error.code >= 500 || error.code === 0;
  return error instanceof Error && error.name === "TimeoutError";
}

export function createAppwriteEmbedder(admin: Client, options: EmbedderOptions = defaultEmbedderOptions): Embedder {
  const service = new Embeddings(admin);

  async function embedBatch(texts: string[]): Promise<number[][]> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        const result = await withTimeout("embeddings.createTextEmbeddings", () => service.createTextEmbeddings({ texts, model: EmbeddingModel.Nomicembedtext }), options.timeoutMs);
        return result.embeddings.map((entry) => {
          if (entry.error !== "" || entry.dimension !== embeddingDimension || entry.embedding.length !== embeddingDimension) {
            throw new KnowledgeError({ code: "embedding_failed" });
          }
          return entry.embedding;
        });
      } catch (error) {
        const delay = retryDelaysMs[attempt];
        if (error instanceof KnowledgeError || delay === undefined || !retryable(error)) {
          throw error instanceof KnowledgeError ? error : new KnowledgeError({ code: "embedding_failed" });
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  return {
    async embedDocuments(items) {
      const texts = items.map((item) => documentText(item, options.prefixMode));
      const batches: string[][] = [];
      for (let start = 0; start < texts.length; start += options.batchSize) batches.push(texts.slice(start, start + options.batchSize));
      const results: number[][][] = new Array(batches.length);
      let next = 0;
      async function worker() {
        while (next < batches.length) {
          const index = next;
          next += 1;
          results[index] = await embedBatch(batches[index] ?? []);
        }
      }
      await Promise.all(Array.from({ length: Math.min(options.concurrency, batches.length) }, worker));
      return results.flat();
    },
    async embedQuery(text) {
      const [vector] = await embedBatch([queryText(text, options.prefixMode)]);
      if (vector === undefined) throw new KnowledgeError({ code: "embedding_failed" });
      return vector;
    },
  };
}
