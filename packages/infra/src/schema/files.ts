import { fileKinds } from "@cortex/core";
import type { TableSpec } from "./types";

export const documentStatuses = ["draft", "approved", "in_progress", "implemented", "superseded", "deprecated"] as const;

export const filesTable: TableSpec = {
  id: "files",
  name: "Files",
  columns: [
    { key: "sectorId", type: "varchar", size: 36, required: true },
    { key: "path", type: "varchar", size: 512, required: true },
    { key: "title", type: "varchar", size: 256, required: true },
    { key: "kind", type: "enum", elements: fileKinds, required: true },
    { key: "hash", type: "varchar", size: 64, required: true },
    { key: "version", type: "integer", min: 1, required: true },
    { key: "size", type: "integer", min: 0, max: 262144, required: true },
    { key: "content", type: "mediumtext", required: true },
    { key: "updatedBy", type: "varchar", size: 36, required: true },
    { key: "authorId", type: "varchar", size: 36, required: true },
    { key: "docId", type: "varchar", size: 32, required: false },
    { key: "status", type: "enum", elements: documentStatuses, required: false },
    { key: "supersedes", type: "varchar", size: 32, required: false },
    { key: "supersededBy", type: "varchar", size: 32, required: false },
    { key: "relatesTo", type: "varchar", size: 32, required: false },
  ],
  indexes: [
    { key: "sector_idx", type: "key", columns: ["sectorId"] },
    { key: "sector_path_unique", type: "unique", columns: ["sectorId", "path"] },
    { key: "sector_doc_unique", type: "unique", columns: ["sectorId", "docId"] },
  ],
};

export const fileVersionsTable: TableSpec = {
  id: "file_versions",
  name: "File versions",
  columns: [
    { key: "fileId", type: "varchar", size: 36, required: true },
    { key: "version", type: "integer", min: 1, required: true },
    { key: "hash", type: "varchar", size: 64, required: true },
    { key: "content", type: "mediumtext", required: true },
    { key: "authorId", type: "varchar", size: 36, required: true },
  ],
  indexes: [{ key: "file_version_unique", type: "unique", columns: ["fileId", "version"] }],
};

export const docReservationsTable: TableSpec = {
  id: "doc_reservations",
  name: "Document reservations",
  columns: [
    { key: "sectorId", type: "varchar", size: 36, required: true },
    { key: "docId", type: "varchar", size: 32, required: true },
    { key: "kind", type: "enum", elements: ["spec", "backlog", "finding"], required: true },
    { key: "reservedBy", type: "varchar", size: 36, required: true },
    { key: "expiresAt", type: "datetime", required: true },
  ],
  indexes: [{ key: "sector_reservation_unique", type: "unique", columns: ["sectorId", "docId"] }],
};
