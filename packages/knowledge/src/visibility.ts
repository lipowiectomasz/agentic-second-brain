import type { ChunkMetadata } from "@cortex/core";

export function isChunkVisible(chunk: Pick<ChunkMetadata, "fileId" | "fileHash">, files: Map<string, { hash: string }>): boolean {
  return files.get(chunk.fileId)?.hash === chunk.fileHash;
}
