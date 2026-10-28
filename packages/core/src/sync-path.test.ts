import { describe, expect, it } from "vitest";
import { validateSyncPath } from "./sync-path";

describe("validateSyncPath", () => {
  it.each([
    ["../x.md", "traversal"],
    ["notes/../../x.md", "traversal"],
    ["/abs.md", "absolute"],
    ["C:/x.md", "absolute"],
    ["a\\b.md", "characters"],
    ["notes/with space.md", "characters"],
    ["x.txt", "extension"],
    ["specs/_INDEX.md", "reserved"],
    [".cortex/state.md", "reserved"],
    [`${"a".repeat(510)}.md`, "length"],
  ])("rejects %s as %s", (path, reason) => {
    expect(validateSyncPath(path, "project")).toEqual({ ok: false, reason });
  });

  it("keeps brains/ and .cortex/ out of the spine only", () => {
    expect(validateSyncPath("brains/atlas/x.md", "spine")).toEqual({ ok: false, reason: "reserved" });
    expect(validateSyncPath("brains/x.md", "project")).toEqual({ ok: true });
  });

  it("accepts ordinary paths", () => {
    expect(validateSyncPath("specs/development/SPEC-001-sync.md", "project")).toEqual({ ok: true });
    expect(validateSyncPath("standards/core/comments.md", "spine")).toEqual({ ok: true });
  });
});
