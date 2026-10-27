import type { Models } from "node-appwrite";
import { Query, TablesDB } from "node-appwrite";
import { withTimeout } from "@cortex/server-kit";
import { bodyOf, renderManagedFrontmatter } from "./frontmatter";
import type { KnowledgeReadDeps } from "./search";
import { mapReadError } from "./search";
import type { FileView, ManifestEntry, ManifestPage } from "./search-types";
import type { FileRow } from "./store";
import { filesTableId, toFileRowFromRaw } from "./store";
import { KnowledgeError, invalidInput } from "./types";

type ReadDeps = Pick<KnowledgeReadDeps, "scoped" | "ids">;

const manifestPageSize = 100;
const manifestColumns = ["$id", "$updatedAt", "sectorId", "path", "hash", "version", "size", "kind", "title", "docId", "status", "supersedes", "supersededBy", "relatesTo", "authorId", "updatedBy"];

function toManifestEntry(row: FileRow): ManifestEntry {
  return {
    fileId: row.id,
    sectorId: row.sectorId,
    path: row.path,
    hash: row.hash,
    version: row.version,
    size: row.size,
    kind: row.kind,
    title: row.title,
    docId: row.docId,
    status: row.status,
    supersedes: row.supersedes,
    supersededBy: row.supersededBy,
    relatesTo: row.relatesTo,
    authorId: row.authorId,
    updatedAt: row.updatedAt,
  };
}

async function loadRow(tables: TablesDB, deps: ReadDeps, input: { fileId: string } | { sectorId: string; path: string }): Promise<FileRow> {
  if ("fileId" in input) {
    const row = await withTimeout("tablesDB.getRow file", () => tables.getRow<Models.Row & Record<string, unknown>>({ databaseId: deps.ids.tables, tableId: filesTableId, rowId: input.fileId }));
    return toFileRowFromRaw(row);
  }
  const list = await withTimeout("tablesDB.listRows file", () =>
    tables.listRows<Models.Row & Record<string, unknown>>({ databaseId: deps.ids.tables, tableId: filesTableId, queries: [Query.equal("sectorId", [input.sectorId]), Query.equal("path", [input.path]), Query.limit(1)] }),
  );
  const row = list.rows[0];
  if (row === undefined) throw new KnowledgeError({ code: "not_found" });
  return toFileRowFromRaw(row);
}

export async function readFile(deps: ReadDeps, input: { fileId: string } | { sectorId: string; path: string }): Promise<FileView> {
  const tables = new TablesDB(deps.scoped);
  try {
    const row = await loadRow(tables, deps, input);
    let supersededByFileId: string | null = null;
    if (row.supersededBy !== null) {
      const replacement = await tables.listRows({
        databaseId: deps.ids.tables,
        tableId: filesTableId,
        queries: [Query.equal("sectorId", [row.sectorId]), Query.equal("docId", [row.supersededBy]), Query.select(["$id"]), Query.limit(1)],
      });
      supersededByFileId = replacement.rows[0]?.$id ?? null;
    }
    return {
      fileId: row.id,
      sectorId: row.sectorId,
      path: row.path,
      title: row.title,
      kind: row.kind,
      version: row.version,
      updatedAt: row.updatedAt,
      content: renderManagedFrontmatter(row.content, row),
      body: bodyOf(row.content),
      docId: row.docId,
      status: row.status,
      supersedes: row.supersedes,
      supersededBy: row.supersededBy,
      supersededByFileId,
      relatesTo: row.relatesTo,
    };
  } catch (error) {
    throw mapReadError(error);
  }
}

export async function listManifest(deps: ReadDeps, input: { sectorIds?: string[]; cursor?: string } = {}): Promise<ManifestPage> {
  if (input.sectorIds !== undefined && input.sectorIds.some((id) => !/^[a-z0-9-]{1,36}$/.test(id))) throw invalidInput("sectorIds");
  const queries = [Query.orderAsc("$id"), Query.limit(manifestPageSize), Query.select(manifestColumns)];
  if (input.sectorIds !== undefined && input.sectorIds.length > 0) queries.push(Query.equal("sectorId", input.sectorIds));
  if (input.cursor !== undefined) queries.push(Query.cursorAfter(input.cursor));
  try {
    const page = await withTimeout("tablesDB.listRows manifest", () =>
      new TablesDB(deps.scoped).listRows<Models.Row & Record<string, unknown>>({ databaseId: deps.ids.tables, tableId: filesTableId, queries }),
    );
    const entries = page.rows.map((row) => toManifestEntry(toFileRowFromRaw(row)));
    const last = entries[entries.length - 1];
    return { entries, nextCursor: entries.length === manifestPageSize && last !== undefined ? last.fileId : null };
  } catch (error) {
    throw mapReadError(error);
  }
}
