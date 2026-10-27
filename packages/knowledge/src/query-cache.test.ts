import { describe, expect, it } from "vitest";
import { createQueryEmbeddingCache } from "./query-cache";

describe("createQueryEmbeddingCache", () => {
  it("normalises queries and evicts the least recently used entry", () => {
    const cache = createQueryEmbeddingCache({ maxEntries: 2, prefixMode: "none" });
    cache.set("Rollback  Plan", [1]);
    cache.set("caching", [2]);
    expect(cache.get(" rollback plan ")).toEqual([1]);
    cache.set("retries", [3]);
    expect(cache.get("caching")).toBeUndefined();
    expect(cache.get("ROLLBACK PLAN")).toEqual([1]);
  });

  it("keeps prefix modes apart", () => {
    const none = createQueryEmbeddingCache({ maxEntries: 5, prefixMode: "none" });
    none.set("q", [1]);
    expect(createQueryEmbeddingCache({ maxEntries: 5, prefixMode: "nomic" }).get("q")).toBeUndefined();
  });
});
