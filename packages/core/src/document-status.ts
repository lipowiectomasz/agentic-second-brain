export const documentStatuses = ["draft", "approved", "in_progress", "implemented", "superseded", "deprecated"] as const;

export type DocumentStatus = (typeof documentStatuses)[number];

export const chunkStatuses = [...documentStatuses, "active"] as const;

export type ChunkStatus = (typeof chunkStatuses)[number];

export const hiddenByDefault: readonly ChunkStatus[] = ["superseded", "deprecated"];
