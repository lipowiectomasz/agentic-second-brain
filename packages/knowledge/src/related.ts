import type { Models } from "node-appwrite";
import { Query, TablesDB, VectorsDB } from "node-appwrite";
import { withTimeout } from "@cortex/server-kit";
import type { KnowledgeReadDeps } from "./search";
import { gateChunks, loadGate, mapReadError, statusPrefilter, vectorQuery } from "./search";
import type { RelatedInput, SearchResult } from "./search-types";
import { relatedInputSchema } from "./search-types";
import { shapeResults } from "./shape-results";
import { chunksCollectionId, filesTableId } from "./store";
import { KnowledgeError, invalidInput } from "./types";
import { meanVector, normalize } from "./vectors";

const sampleChunks = 8;

export async function related(deps: Pick<KnowledgeReadDeps, "scoped" | "ids">, rawInput: RelatedInput): Promise<SearchResult[]> {
  const parsed = relatedInputSchema.safeParse(rawInput);
  if (!parsed.success) throw invalidInput("related");
  const input = parsed.data;
  try {
    const row = await withTimeout("tablesDB.getRow related file", () =>
      new TablesDB(deps.scoped).getRow<Models.Row & { hash: string }>({ databaseId: deps.ids.tables, tableId: filesTableId, rowId: input.fileId, queries: [Query.select(["$id", "hash"])] }),
    );
    const sample = await withTimeout("vectorsDB.listDocuments related sample", () =>
      new VectorsDB(deps.scoped).listDocuments<Models.Document & { embeddings: number[] }>({
        databaseId: deps.ids.vectors,
        collectionId: chunksCollectionId,
        queries: [Query.equal("metadata.fileId", [input.fileId]), Query.equal("metadata.fileHash", [row.hash]), Query.select(["embeddings"]), Query.orderAsc("$createdAt"), Query.limit(sampleChunks)],
      }),
    );
    if (sample.documents.length === 0) return [];
    const vector = normalize(meanVector(sample.documents.map((document) => document.embeddings)));
    const queries = [Query.vectorCosine("embeddings", vector), Query.notEqual("metadata.fileId", input.fileId), Query.select(["$id", "metadata"]), Query.limit(input.limit * 4)];
    if (!input.includeSuperseded) queries.push(...statusPrefilter());
    const chunks = await vectorQuery(deps, queries);
    const gate = await loadGate(deps, [...new Set(chunks.map((chunk) => chunk.fileId))]);
    return shapeResults(gateChunks(chunks, gate.files, input.includeSuperseded), gate.files, gate.sectors, input.limit, 1);
  } catch (error) {
    throw error instanceof KnowledgeError ? error : mapReadError(error);
  }
}
