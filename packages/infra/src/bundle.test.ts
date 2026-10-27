import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { bundleFunction } from "./bundle";
import type { FunctionSpec } from "./schema/types";

const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
const health: FunctionSpec = {
  id: "health",
  name: "Health",
  entry: "functions/health/src/main.ts",
  runtime: "node-22",
  scopes: [],
  execute: [],
  timeout: 15,
  logging: true,
  variables: {},
};

const directories: string[] = [];

afterAll(async () => {
  await Promise.all(directories.map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("bundleFunction", () => {
  it("produces the same hash for unchanged source", async () => {
    const first = await mkdtemp(path.join(tmpdir(), "bundle-"));
    const second = await mkdtemp(path.join(tmpdir(), "bundle-"));
    directories.push(first, second);
    const a = await bundleFunction(health, repositoryRoot, first);
    const b = await bundleFunction(health, repositoryRoot, second);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.hash).toBe(b.hash);
  });
});
