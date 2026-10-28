import type { Models } from "node-appwrite";
import { Query, VectorsDB } from "node-appwrite";
import { withTimeout } from "@cortex/server-kit";
import type { KnowledgeReadDeps } from "./search";
import { chunksCollectionId } from "./store";
import { meanVector, normalize } from "./vectors";

export interface FileVectorCache {
  get(key: string): number[] | undefined;
  set(key: string, vector: number[]): void;
  size(): number;
}

export function createFileVectorCache(maxEntries: number): FileVectorCache {
  const entries = new Map<string, number[]>();
  return {
    get(key) {
      const value = entries.get(key);
      if (value !== undefined) {
        entries.delete(key);
        entries.set(key, value);
      }
      return value;
    },
    set(key, vector) {
      entries.delete(key);
      entries.set(key, vector);
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value as string);
    },
    size() {
      return entries.size;
    },
  };
}

const groupSize = 50;
const pageSize = 100;
const sampleChunks = 8;

type ChunkDocument = Models.Document & { embeddings: number[]; metadata: { fileId: string; fileHash: string } };

export async function loadFileVectors(deps: Pick<KnowledgeReadDeps, "scoped" | "ids">, cache: FileVectorCache, files: Array<{ id: string; hash: string }>): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>();
  const missing: Array<{ id: string; hash: string }> = [];
  for (const file of files) {
    const cached = cache.get(`${file.id}:${file.hash}`);
    if (cached === undefined) missing.push(file);
    else result.set(file.id, cached);
  }
  const vectors = new VectorsDB(deps.scoped);
  for (let start = 0; start < missing.length; start += groupSize) {
    const group = missing.slice(start, start + groupSize);
    const hashes = new Map(group.map((file) => [file.id, file.hash]));
    const samples = new Map<string, number[][]>();
    let cursor: string | undefined;
    do {
      const queries = [Query.equal("metadata.fileId", group.map((file) => file.id)), Query.select(["$id", "embeddings", "metadata"]), Query.orderAsc("$id"), Query.limit(pageSize)];
      if (cursor !== undefined) queries.push(Query.cursorAfter(cursor));
      const page = await withTimeout("vectorsDB.listDocuments map vectors", () => vectors.listDocuments<ChunkDocument>({ databaseId: deps.ids.vectors, collectionId: chunksCollectionId, queries }));
      for (const document of page.documents) {
        if (hashes.get(document.metadata.fileId) !== document.metadata.fileHash) continue;
        const list = samples.get(document.metadata.fileId) ?? [];
        if (list.length < sampleChunks) list.push(document.embeddings);
        samples.set(document.metadata.fileId, list);
      }
      cursor = page.documents.length === pageSize ? page.documents.at(-1)?.$id : undefined;
    } while (cursor !== undefined);
    for (const file of group) {
      const sample = samples.get(file.id);
      if (sample === undefined || sample.length === 0) continue;
      const vector = normalize(meanVector(sample));
      cache.set(`${file.id}:${file.hash}`, vector);
      result.set(file.id, vector);
    }
  }
  return result;
}
