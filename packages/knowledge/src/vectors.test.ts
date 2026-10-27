import { describe, expect, it } from "vitest";
import { cosineSimilarity, meanVector, normalize, similarityFromDistance } from "./vectors";
import { isChunkVisible } from "./visibility";

describe("vectors", () => {
  it("averages vectors", () => {
    expect(meanVector([[1, 3], [3, 5]])).toEqual([2, 4]);
    expect(meanVector([])).toEqual([]);
  });

  it("normalises to unit length and keeps the zero vector", () => {
    expect(normalize([3, 4])).toEqual([0.6, 0.8]);
    expect(normalize([0, 0])).toEqual([0, 0]);
  });

  it("computes cosine similarity", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it("clamps similarity from distance", () => {
    expect(similarityFromDistance(0.2)).toBeCloseTo(0.8);
    expect(similarityFromDistance(1.5)).toBe(0);
    expect(similarityFromDistance(-0.1)).toBe(1);
  });
});

describe("isChunkVisible", () => {
  const files = new Map([["f1", { hash: "a".repeat(64) }]]);
  it("shows only chunks of the current file hash", () => {
    expect(isChunkVisible({ fileId: "f1", fileHash: "a".repeat(64) }, files)).toBe(true);
    expect(isChunkVisible({ fileId: "f1", fileHash: "b".repeat(64) }, files)).toBe(false);
    expect(isChunkVisible({ fileId: "f2", fileHash: "a".repeat(64) }, files)).toBe(false);
  });
});
