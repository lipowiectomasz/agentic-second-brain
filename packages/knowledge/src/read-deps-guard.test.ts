import { describe, expect, it } from "vitest";
import { listManifest } from "./read-file";
import { readFile } from "./read-file";
import { related } from "./related";
import { search } from "./search";
import { createQueryEmbeddingCache } from "./query-cache";

const allowed = new Set(["scoped", "ids", "embedder", "queryCache"]);

function guardedDeps() {
  const touched = new Set<string>();
  const failing = new Proxy({}, { get: () => () => Promise.reject(new Error("offline")) });
  const target = {
    scoped: failing,
    ids: { vectors: "v", tables: "t" },
    embedder: { embedQuery: async () => [0], embedDocuments: async () => [] },
    queryCache: createQueryEmbeddingCache({ maxEntries: 1, prefixMode: "none" }),
  };
  const deps = new Proxy(target, {
    get(object, key) {
      if (typeof key === "string") touched.add(key);
      return Reflect.get(object, key);
    },
  });
  return { deps, touched };
}

describe("read path dependency guard", () => {
  it.each([
    ["search", (deps: never) => search(deps, { query: "q" })],
    ["related", (deps: never) => related(deps, { fileId: "f1" })],
    ["readFile", (deps: never) => readFile(deps, { fileId: "f1" })],
    ["listManifest", (deps: never) => listManifest(deps, {})],
  ])("%s only reads scoped dependencies, never an admin client", async (_, run) => {
    const { deps, touched } = guardedDeps();
    await run(deps as never).catch(() => undefined);
    expect([...touched].every((key) => allowed.has(key))).toBe(true);
    expect(touched.has("admin")).toBe(false);
  });
});
