import type { Client, Models } from "node-appwrite";
import { Query, TablesDB, VectorsDB } from "node-appwrite";
import type { DatabaseIds } from "@cortex/config";
import type { DocumentStatus, FileKind, SectorKind } from "@cortex/core";
import { withTimeout } from "@cortex/server-kit";
import { KnowledgeError } from "./types";

export const filesTableId = "files";
export const fileVersionsTableId = "file_versions";
export const reservationsTableId = "doc_reservations";
export const sectorsTableId = "sectors";
export const chunksCollectionId = "chunks";

export interface SectorInfo {
  id: string;
  kind: SectorKind;
  teamId: string;
}

export interface FileRow {
  id: string;
  sectorId: string;
  path: string;
  title: string;
  kind: FileKind;
  hash: string;
  version: number;
  size: number;
  content: string;
  updatedBy: string;
  authorId: string;
  docId: string | null;
  status: DocumentStatus | null;
  supersedes: string | null;
  supersededBy: string | null;
  relatesTo: string | null;
  updatedAt: string;
}

type RawFileRow = Models.Row & Omit<FileRow, "id" | "updatedAt" | "docId" | "status" | "supersedes" | "supersededBy" | "relatesTo"> & {
  docId?: string | null;
  status?: DocumentStatus | null;
  supersedes?: string | null;
  supersededBy?: string | null;
  relatesTo?: string | null;
};

export function toFileRowFromRaw(row: Record<string, unknown>): FileRow {
  return toFileRow(row as RawFileRow);
}

export function toFileRow(row: RawFileRow): FileRow {
  return {
    id: row.$id,
    sectorId: row.sectorId,
    path: row.path,
    title: row.title,
    kind: row.kind,
    hash: row.hash,
    version: row.version,
    size: row.size,
    content: row.content ?? "",
    updatedBy: row.updatedBy,
    authorId: row.authorId,
    docId: row.docId ?? null,
    status: row.status ?? null,
    supersedes: row.supersedes ?? null,
    supersededBy: row.supersededBy ?? null,
    relatesTo: row.relatesTo ?? null,
    updatedAt: row.$updatedAt,
  };
}

export class KnowledgeStore {
  readonly tables: TablesDB;
  readonly vectors: VectorsDB;

  constructor(client: Client, readonly ids: DatabaseIds) {
    this.tables = new TablesDB(client);
    this.vectors = new VectorsDB(client);
  }

  async sector(sectorId: string): Promise<SectorInfo> {
    try {
      const row = await withTimeout("tablesDB.getRow sector", () =>
        this.tables.getRow<Models.Row & { kind: SectorKind; teamId: string }>({ databaseId: this.ids.tables, tableId: sectorsTableId, rowId: sectorId }),
      );
      return { id: row.$id, kind: row.kind, teamId: row.teamId };
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === 404) throw new KnowledgeError({ code: "sector_not_found" });
      throw error;
    }
  }

  async fileByPath(sectorId: string, path: string): Promise<FileRow | null> {
    const list = await withTimeout("tablesDB.listRows file by path", () =>
      this.tables.listRows<RawFileRow>({ databaseId: this.ids.tables, tableId: filesTableId, queries: [Query.equal("sectorId", [sectorId]), Query.equal("path", [path]), Query.limit(1)] }),
    );
    const row = list.rows[0];
    return row === undefined ? null : toFileRow(row);
  }

  async fileByDocId(sectorId: string, docId: string): Promise<FileRow | null> {
    const list = await withTimeout("tablesDB.listRows file by doc", () =>
      this.tables.listRows<RawFileRow>({ databaseId: this.ids.tables, tableId: filesTableId, queries: [Query.equal("sectorId", [sectorId]), Query.equal("docId", [docId]), Query.limit(1)] }),
    );
    const row = list.rows[0];
    return row === undefined ? null : toFileRow(row);
  }

  async versionContent(fileId: string, version: number | null, hash: string | null): Promise<string | null> {
    const queries = [Query.equal("fileId", [fileId]), Query.limit(1)];
    if (version !== null) {
      const list = await withTimeout("tablesDB.listRows version", () =>
        this.tables.listRows<Models.Row & { hash: string; content: string }>({ databaseId: this.ids.tables, tableId: fileVersionsTableId, queries: [...queries, Query.equal("version", [version])] }),
      );
      const row = list.rows[0];
      if (row !== undefined && (hash === null || row.hash === hash)) return row.content;
    }
    if (hash === null) return null;
    const byHash = await withTimeout("tablesDB.listRows version by hash", () =>
      this.tables.listRows<Models.Row & { content: string }>({ databaseId: this.ids.tables, tableId: fileVersionsTableId, queries: [...queries, Query.equal("hash", [hash]), Query.orderDesc("version")] }),
    );
    return byHash.rows[0]?.content ?? null;
  }

  async purgeOrphanChunks(fileId: string, keepHash: string | null): Promise<number> {
    const queries = [Query.equal("metadata.fileId", [fileId])];
    if (keepHash !== null) queries.push(Query.notEqual("metadata.fileHash", [keepHash]));
    const result = await withTimeout("vectorsDB.deleteDocuments orphans", () =>
      this.vectors.deleteDocuments({ databaseId: this.ids.vectors, collectionId: chunksCollectionId, queries }),
    );
    return result.total;
  }
}
