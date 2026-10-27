import { describe, expect, it } from "vitest";
import { bodyHash } from "@cortex/core";
import { bodyOf, renderManagedFrontmatter } from "./frontmatter";

const none = { docId: null, status: null, supersedes: null, supersededBy: null, relatesTo: null };

describe("renderManagedFrontmatter", () => {
  it("returns stored content unchanged without managed values", () => {
    expect(renderManagedFrontmatter("# Body\n", none)).toBe("# Body\n");
  });

  it("creates a block and orders managed keys first", () => {
    expect(renderManagedFrontmatter("# Body\n", { ...none, docId: "SPEC-001", status: "approved", supersedes: "SPEC-000" })).toBe(
      "---\nid: SPEC-001\nstatus: approved\nsupersedes: SPEC-000\n---\n# Body\n",
    );
  });

  it("keeps author keys after the managed ones and replaces stale managed values", () => {
    const stored = "---\nstatus: draft\ntitle: Keep\n---\nBody\n";
    expect(renderManagedFrontmatter(stored, { ...none, docId: "TASK-002", status: "approved" })).toBe("---\nid: TASK-002\nstatus: approved\ntitle: Keep\n---\nBody\n");
  });

  it("never changes the body hash", () => {
    const samples = ["Body\n", "---\ntitle: x\n---\nBody\n", "---\nid: SPEC-1\n---\n", "---\nx: 1\n  y: 2\n---\n# H\n\ntext\r\n"];
    const rows = [none, { ...none, docId: "SPEC-001" }, { docId: "FINDING-001", status: "approved" as const, supersedes: null, supersededBy: "SPEC-009", relatesTo: "SPEC-001" }];
    for (const sample of samples) {
      for (const row of rows) expect(bodyHash(renderManagedFrontmatter(sample, row))).toBe(bodyHash(sample));
    }
  });
});

describe("bodyOf", () => {
  it("returns the content after the frontmatter block", () => {
    expect(bodyOf("---\ntitle: x\n---\n# H\n")).toBe("# H\n");
    expect(bodyOf("# H\n")).toBe("# H\n");
  });
});
