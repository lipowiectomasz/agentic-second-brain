import type { Models } from "node-appwrite";
import { Query, TablesDB } from "node-appwrite";
import type { FileKind } from "@cortex/core";
import { withTimeout } from "@cortex/server-kit";
import type { FileVectorCache } from "./file-vectors";
import { loadFileVectors } from "./file-vectors";
import { buildBrainGraph } from "./graph";
import type { BrainGraph } from "./graph-types";
import type { KnowledgeReadDeps } from "./search";
import { mapReadError } from "./search";
import { filesTableId, sectorsTableId } from "./store";

type FileRow = Models.Row & { sectorId: string; title: string; path: string; kind: FileKind; hash: string; status: string | null };
type SectorRow = Models.Row & { name: string; color: string; kind: "spine" | "project" };

const maxFiles = 2000;

async function readableFiles(tables: TablesDB, databaseId: string): Promise<FileRow[]> {
  const rows: FileRow[] = [];
  let cursor: string | undefined;
  do {
    const queries = [Query.select(["$id", "sectorId", "title", "path", "kind", "hash", "status"]), Query.orderAsc("$id"), Query.limit(100)];
    if (cursor !== undefined) queries.push(Query.cursorAfter(cursor));
    const page = await withTimeout("tablesDB.listRows map files", () => tables.listRows<FileRow>({ databaseId, tableId: filesTableId, queries }));
    rows.push(...page.rows);
    cursor = page.rows.length === 100 && rows.length < maxFiles ? page.rows.at(-1)?.$id : undefined;
  } while (cursor !== undefined);
  return rows;
}

export async function getBrainGraph(deps: Pick<KnowledgeReadDeps, "scoped" | "ids">, cache: FileVectorCache, options: { readableSectorIds: string[]; now: Date }): Promise<BrainGraph> {
  const tables = new TablesDB(deps.scoped);
  let sectors: SectorRow[];
  let files: FileRow[];
  try {
    [sectors, files] = await Promise.all([
      withTimeout("tablesDB.listRows map sectors", () => tables.listRows<SectorRow>({ databaseId: deps.ids.tables, tableId: sectorsTableId, queries: [Query.select(["$id", "name", "color", "kind"]), Query.limit(100)] })).then((list) => list.rows),
      readableFiles(tables, deps.ids.tables),
    ]);
  } catch (error) {
    throw mapReadError(error);
  }
  const current = files.filter((row) => row.status !== "superseded" && row.status !== "deprecated");
  let vectors = new Map<string, number[]>();
  let linksAvailable = true;
  try {
    vectors = await loadFileVectors(deps, cache, current.map((row) => ({ id: row.$id, hash: row.hash })));
  } catch {
    linksAvailable = false;
  }
  return buildBrainGraph({
    sectors: sectors.map((row) => ({ id: row.$id, name: row.name, color: row.color, kind: row.kind })),
    readableSectorIds: new Set([...options.readableSectorIds, ...current.map((row) => row.sectorId)]),
    files: current.map((row) => ({ id: row.$id, sectorId: row.sectorId, title: row.title, path: row.path, kind: row.kind })),
    vectors,
    linksAvailable,
    now: options.now,
  });
}
