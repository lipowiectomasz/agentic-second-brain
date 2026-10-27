import type { Client, Models } from "node-appwrite";
import { AppwriteException, Query, TablesDB, VectorsDB } from "node-appwrite";
import type { DatabaseIds } from "@cortex/config";
import type { ChunkMetadata, DocumentStatus, FileKind } from "@cortex/core";
import { chunkMetadataSchema, hiddenByDefault } from "@cortex/core";
import { withTimeout } from "@cortex/server-kit";
import type { Embedder } from "./embedder";
import type { QueryEmbeddingCache } from "./query-cache";
import type { FileRowSummary, RankedChunk, SectorSummary } from "./shape-results";
import { shapeResults } from "./shape-results";
import type { SearchInput, SearchResult } from "./search-types";
import { searchInputSchema } from "./search-types";
import { chunksCollectionId, filesTableId, sectorsTableId } from "./store";
import { KnowledgeError, invalidInput } from "./types";
import { isChunkVisible } from "./visibility";

export interface KnowledgeReadDeps {
  scoped: Client;
  ids: DatabaseIds;
  embedder: Embedder;
  queryCache: QueryEmbeddingCache;
}

export const hiddenStatuses = hiddenByDefault as readonly string[];

export function statusPrefilter(): string[] {
  return hiddenStatuses.map((status) => Query.notEqual("metadata.status", status));
}

export function mapReadError(error: unknown): KnowledgeError {
  if (error instanceof KnowledgeError) return error;
  if (error instanceof AppwriteException && error.code === 401) return new KnowledgeError({ code: "forbidden", reason: "role" });
  if (error instanceof AppwriteException && error.code === 404) return new KnowledgeError({ code: "not_found" });
  console.error("knowledge read failed", error instanceof AppwriteException ? `${error.code} ${error.type} ${error.message}` : error instanceof Error ? error.name : "unknown");
  return new KnowledgeError({ code: "storage_failed" });
}

export async function embedQueryCached(deps: Pick<KnowledgeReadDeps, "embedder" | "queryCache">, query: string): Promise<number[]> {
  const cached = deps.queryCache.get(query);
  if (cached !== undefined) return cached;
  const vector = await deps.embedder.embedQuery(query);
  deps.queryCache.set(query, vector);
  return vector;
}

export function narrowChunks(documents: Array<Models.Document & { metadata?: unknown; $distance?: number }>): RankedChunk[] {
  const chunks: RankedChunk[] = [];
  for (const document of documents) {
    const parsed = chunkMetadataSchema.safeParse(document.metadata);
    if (!parsed.success) {
      console.error("chunk metadata rejected", document.$id);
      continue;
    }
    chunks.push({ ...parsed.data, $id: document.$id, distance: document.$distance ?? 1 });
  }
  return chunks;
}

export async function vectorQuery(deps: Pick<KnowledgeReadDeps, "scoped" | "ids">, queries: string[]): Promise<RankedChunk[]> {
  const result = await withTimeout(
    "vectorsDB.createQuery",
    () => new VectorsDB(deps.scoped).createQuery<Models.Document & { metadata: ChunkMetadata; $distance?: number }>({ databaseId: deps.ids.vectors, collectionId: chunksCollectionId, queries }),
    10_000,
  );
  return narrowChunks(result.documents);
}

export async function loadGate(deps: Pick<KnowledgeReadDeps, "scoped" | "ids">, fileIds: string[]): Promise<{ files: Map<string, FileRowSummary>; sectors: Map<string, SectorSummary> }> {
  const tables = new TablesDB(deps.scoped);
  const [fileRows, sectorRows] = await Promise.all([
    fileIds.length === 0
      ? Promise.resolve({ rows: [] as Array<Models.Row & FileRowFields> })
      : withTimeout("tablesDB.listRows gate files", () =>
          tables.listRows<Models.Row & FileRowFields>({
            databaseId: deps.ids.tables,
            tableId: filesTableId,
            queries: [Query.equal("$id", fileIds), Query.select(["$id", "hash", "title", "path", "kind", "sectorId", "docId", "status"]), Query.limit(fileIds.length)],
          }),
        ),
    withTimeout("tablesDB.listRows gate sectors", () =>
      tables.listRows<Models.Row & { name: string; color: string }>({ databaseId: deps.ids.tables, tableId: sectorsTableId, queries: [Query.select(["$id", "name", "color"]), Query.limit(100)] }),
    ),
  ]);
  return {
    files: new Map(
      fileRows.rows.map((row) => [
        row.$id,
        { hash: row.hash, title: row.title, path: row.path, kind: row.kind, sectorId: row.sectorId, docId: row.docId ?? null, status: row.status ?? null },
      ]),
    ),
    sectors: new Map(sectorRows.rows.map((row) => [row.$id, { name: row.name, color: row.color }])),
  };
}

interface FileRowFields {
  hash: string;
  title: string;
  path: string;
  kind: FileKind;
  sectorId: string;
  docId?: string | null;
  status?: DocumentStatus | null;
}

export function gateChunks(chunks: RankedChunk[], files: Map<string, FileRowSummary>, includeSuperseded: boolean): RankedChunk[] {
  return chunks.filter((chunk) => {
    if (!isChunkVisible(chunk, files)) return false;
    const status = files.get(chunk.fileId)?.status ?? null;
    return includeSuperseded || status === null || !hiddenStatuses.includes(status);
  });
}

export async function search(deps: KnowledgeReadDeps, rawInput: SearchInput): Promise<SearchResult[]> {
  const parsed = searchInputSchema.safeParse(rawInput);
  if (!parsed.success) throw invalidInput(...parsed.error.issues.map((issue) => issue.path.join(".")));
  const input = parsed.data;
  try {
    const vector = await embedQueryCached(deps, input.query);
    const queries = [Query.vectorCosine("embeddings", vector), Query.select(["$id", "metadata"]), Query.limit(input.limit * 3)];
    if (input.sectorIds !== undefined && input.sectorIds.length > 0) queries.push(Query.equal("metadata.sectorId", input.sectorIds));
    if (input.kinds !== undefined && input.kinds.length > 0) queries.push(Query.equal("metadata.kind", input.kinds));
    if (!input.includeSuperseded) queries.push(...statusPrefilter());
    const chunks = await vectorQuery(deps, queries);
    const gate = await loadGate(deps, [...new Set(chunks.map((chunk) => chunk.fileId))]);
    return shapeResults(gateChunks(chunks, gate.files, input.includeSuperseded), gate.files, gate.sectors, input.limit);
  } catch (error) {
    throw mapReadError(error);
  }
}
