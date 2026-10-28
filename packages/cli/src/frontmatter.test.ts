import { describe, expect, it } from "vitest";
import { bodyHash, editedManagedKeys, stripManaged, writeManaged } from "./frontmatter";

const meta = { docId: "SPEC-001", status: "approved" as const, supersedes: null, supersededBy: "SPEC-002", relatesTo: null, authorId: "u1" };

describe("managed frontmatter", () => {
  it("writes managed keys first and keeps the others in order", () => {
    const written = writeManaged("---\ntitle: Sync\nstatus: draft\nowner: ada\n---\n# Sync\n", meta);
    expect(written).toBe("---\nid: SPEC-001\nstatus: approved\nsuperseded_by: SPEC-002\ntitle: Sync\nowner: ada\n---\n# Sync\n");
    expect(writeManaged(written, meta)).toBe(written);
  });

  it("strips managed keys and returns the declared links of a new file", () => {
    const stripped = stripManaged("---\nid: SPEC-003\nsupersedes: SPEC-001\nrelates_to: nonsense\ntags: a\n---\nBody\n");
    expect(stripped).toEqual({ text: "---\ntags: a\n---\nBody\n", declared: { supersedes: "SPEC-001", relatesTo: null } });
  });

  it("ignores managed keys and line endings in the body hash", () => {
    expect(bodyHash("---\nid: SPEC-001\nstatus: draft\n---\r\nBody\r\n")).toBe(bodyHash("Body\n"));
  });

  it("reports local edits of managed keys", () => {
    expect(editedManagedKeys(writeManaged("# Sync\n", meta).replace("status: approved", "status: draft"), meta)).toEqual(["status"]);
    expect(editedManagedKeys(writeManaged("# Sync\n", meta), meta)).toEqual([]);
  });
});
