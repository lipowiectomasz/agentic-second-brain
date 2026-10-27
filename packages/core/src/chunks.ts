import { z } from "zod";
import { chunkStatuses } from "./document-status";
import { fileKinds } from "./file-kind";

export const chunkMetadataSchema = z.object({
  sectorId: z.string().regex(/^[a-z0-9-]{1,36}$/),
  fileId: z.string().min(1).max(36),
  path: z.string().max(512),
  heading: z.string().max(256),
  chunkIndex: z.string().regex(/^\d{1,3}$/),
  kind: z.enum(fileKinds),
  text: z.string().min(1).max(6000),
  fileHash: z.string().regex(/^[a-f0-9]{64}$/),
  docId: z.string().max(32),
  status: z.enum(chunkStatuses),
});

export type ChunkMetadata = z.infer<typeof chunkMetadataSchema>;

export const maxChunksPerFile = 48;

export const maxFileBytes = 262144;

export const embeddingDimension = 768;
