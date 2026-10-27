import { z } from "zod";
import type { ChunkStatus, DocumentStatus, FileKind } from "@cortex/core";
import { fileKinds } from "@cortex/core";

export const searchInputSchema = z.object({
  query: z.string().trim().min(1).max(500),
  sectorIds: z.array(z.string().regex(/^[a-z0-9-]{1,36}$/)).max(50).optional(),
  kinds: z.array(z.enum(fileKinds)).max(fileKinds.length).optional(),
  limit: z.number().int().min(1).max(20).default(10),
  includeSuperseded: z.boolean().default(false),
});
export type SearchInput = z.input<typeof searchInputSchema>;

export const relatedInputSchema = z.object({
  fileId: z.string().min(1).max(36),
  limit: z.number().int().min(1).max(10).default(5),
  includeSuperseded: z.boolean().default(false),
});
export type RelatedInput = z.input<typeof relatedInputSchema>;

export interface SearchResult {
  chunkId: string;
  sectorId: string;
  sectorName: string;
  sectorColor: string;
  fileId: string;
  path: string;
  title: string;
  kind: FileKind;
  heading: string;
  anchor: string;
  snippet: string;
  similarity: number;
  docId: string | null;
  status: ChunkStatus;
}

export interface FileView {
  fileId: string;
  sectorId: string;
  path: string;
  title: string;
  kind: FileKind;
  version: number;
  updatedAt: string;
  content: string;
  body: string;
  docId: string | null;
  status: DocumentStatus | null;
  supersedes: string | null;
  supersededBy: string | null;
  supersededByFileId: string | null;
  relatesTo: string | null;
}

export interface ManifestEntry {
  fileId: string;
  sectorId: string;
  path: string;
  hash: string;
  version: number;
  size: number;
  kind: FileKind;
  title: string;
  docId: string | null;
  status: DocumentStatus | null;
  supersedes: string | null;
  supersededBy: string | null;
  relatesTo: string | null;
  authorId: string;
  updatedAt: string;
}

export interface ManifestPage {
  entries: ManifestEntry[];
  nextCursor: string | null;
}
