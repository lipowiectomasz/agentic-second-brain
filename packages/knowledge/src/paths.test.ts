import { describe, expect, it } from "vitest";
import { classifyPath, titleFromContent } from "./paths";
import { knowledgePathSchema } from "./types";

describe("classifyPath", () => {
  it.each([
    ["standards/core/git.md", "spine", "standard", null],
    ["procedures/release.md", "spine", "procedure", null],
    ["specs/development/SPEC-014-proposals.md", "project", "spec", "SPEC-014"],
    ["docs/backlog/TASK-007_sync.md", "project", "backlog", "TASK-007"],
    ["docs/backlog/TASK-1002-big.md", "project", "backlog", "TASK-1002"],
    ["docs/findings/FINDING-003-chunks.md", "project", "finding", "FINDING-003"],
    ["memory/ada/notes.md", "project", "memory", null],
    ["mirror/apps/web/AGENTS.md", "project", "module", null],
    ["AGENTS.md", "spine", "module", null],
    ["docs/design/guide.md", "project", "note", null],
  ] as const)("classifies %s", (path, sector, kind, docId) => {
    expect(classifyPath(path, sector)).toEqual({ kind, docId });
  });

  it("refuses spine kinds outside the spine and documents inside it", () => {
    expect(classifyPath("standards/x.md", "project")).toEqual({ error: { code: "invalid_input", issues: ["kind_not_allowed_in_sector"] } });
    expect(classifyPath("specs/SPEC-001-x.md", "spine")).toEqual({ error: { code: "invalid_input", issues: ["kind_not_allowed_in_sector"] } });
  });

  it("refuses malformed document file names", () => {
    expect(classifyPath("specs/development/my-spec.md", "project")).toEqual({ error: { code: "invalid_input", issues: ["doc_path_pattern"] } });
    expect(classifyPath("docs/findings/FINDING-3-x.md", "project")).toEqual({ error: { code: "invalid_input", issues: ["doc_path_pattern"] } });
  });
});

describe("knowledgePathSchema", () => {
  it.each(["../etc/passwd.md", "/abs.md", "a/./b.md", "a b.md", "notes.txt", "a//b.md"])("rejects %s", (path) => {
    expect(knowledgePathSchema.safeParse(path).success).toBe(false);
  });

  it("accepts a nested relative path", () => {
    expect(knowledgePathSchema.safeParse("docs/a_b/c-1.d.md").success).toBe(true);
  });
});

describe("titleFromContent", () => {
  it("uses the first H1 outside fences", () => {
    expect(titleFromContent("```\n# not this\n```\n# Real title\n", "x.md")).toBe("Real title");
  });

  it("falls back to the file name", () => {
    expect(titleFromContent("no heading", "docs/rollback-plan.md")).toBe("rollback-plan");
  });
});
