import { describe, expect, it } from "vitest";
import { createFileVectorCache } from "./file-vectors";

describe("file vector cache", () => {
  it("keys by file and hash and evicts the least recently used entry", () => {
    const cache = createFileVectorCache(2);
    cache.set("a:1", [1]);
    cache.set("b:1", [2]);
    expect(cache.get("a:1")).toEqual([1]);
    cache.set("c:1", [3]);
    expect(cache.get("b:1")).toBeUndefined();
    expect(cache.get("a:2")).toBeUndefined();
    expect(cache.size()).toBe(2);
  });
});
