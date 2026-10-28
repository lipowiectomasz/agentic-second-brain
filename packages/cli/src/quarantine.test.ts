import { mkdir, mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listQuarantine, quarantine } from "./quarantine";

describe("quarantine", () => {
  it("moves the file under .cortex/quarantine with private directories", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "cortex-q-"));
    await mkdir(path.join(root, "brains/atlas/notes"), { recursive: true });
    await writeFile(path.join(root, "brains/atlas/notes/env.md"), "key");
    await quarantine(root, "brains/atlas/notes/env.md");
    await expect(stat(path.join(root, "brains/atlas/notes/env.md"))).rejects.toThrow();
    expect((await stat(path.join(root, ".cortex/quarantine"))).mode & 0o777).toBe(0o700);
    expect(await listQuarantine(root)).toEqual(["brains/atlas/notes/env.md"]);
  });

  it("refuses paths that escape the root", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "cortex-q-"));
    await expect(quarantine(root, "../outside.md")).rejects.toThrow("outside the sync root");
  });
});
