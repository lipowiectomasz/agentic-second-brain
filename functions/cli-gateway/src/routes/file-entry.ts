import type { FileEntry } from "@cortex/gateway-contract";
import type { FileRow, ManifestEntry } from "@cortex/knowledge";

export function entryFromManifest(entry: ManifestEntry): FileEntry {
  return {
    fileId: entry.fileId,
    sectorId: entry.sectorId,
    path: entry.path,
    kind: entry.kind,
    version: entry.version,
    hash: entry.hash,
    size: entry.size,
    title: entry.title,
    updatedAt: entry.updatedAt,
    meta: { docId: entry.docId, status: entry.status, supersedes: entry.supersedes, supersededBy: entry.supersededBy, relatesTo: entry.relatesTo, authorId: entry.authorId },
  };
}

export function entryFromRow(row: FileRow): FileEntry {
  return entryFromManifest({ ...row, fileId: row.id });
}
