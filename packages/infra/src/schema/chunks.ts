import type { CollectionSpec } from "./types";

export const chunksCollection: CollectionSpec = {
  id: "chunks",
  name: "Chunks",
  dimension: 768,
  indexes: [{ key: "embeddings_cosine", type: "hnsw_cosine" }],
};
