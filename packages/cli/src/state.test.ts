import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { emptyState, readState, writeState } from "./state";

const identity = { endpoint: "http://localhost/v1", projectId: "cortex", userId: "u1" };

describe("state", () => {
  it("round-trips and keeps the previous file intact when a temporary write is left behind", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "cortex-state-"));
    const state = emptyState({ ...identity, authorSlug: "ada" });
    await writeState(root, state);
    await writeFile(path.join(root, ".cortex", "state.json.tmp"), "{ broken");
    expect(await readState(root, identity)).toEqual(state);
    expect(JSON.parse(await readFile(path.join(root, ".cortex", "state.json"), "utf8")).schema).toBe(2);
  });

  it("refuses a state written for another account", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "cortex-state-"));
    await writeState(root, emptyState({ ...identity, authorSlug: "ada" }));
    await expect(readState(root, { ...identity, userId: "u2" })).rejects.toThrow("another account");
  });

  it("returns null when nothing was synced yet", async () => {
    expect(await readState(await mkdtemp(path.join(tmpdir(), "cortex-state-")), identity)).toBeNull();
  });
});
