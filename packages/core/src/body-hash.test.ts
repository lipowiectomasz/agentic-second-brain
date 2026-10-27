import { describe, expect, it } from "vitest";
import { bodyHash, splitFrontmatter, stripManagedFrontmatter } from "./body-hash";

describe("stripManagedFrontmatter", () => {
  it("removes managed keys and their continuation lines, keeps author keys byte for byte", () => {
    const content = "---\nid: SPEC-001\ntitle: Keep me\nstatus: draft\nsupersedes:\n  - SPEC-000\ntags: [a, b]\n---\n# Body\n";
    expect(stripManagedFrontmatter(content)).toBe("---\ntitle: Keep me\ntags: [a, b]\n---\n# Body\n");
  });

  it("removes a block left empty", () => {
    expect(stripManagedFrontmatter("---\nid: SPEC-001\nstatus: approved\n---\n# Body\n")).toBe("# Body\n");
  });

  it("normalises CRLF", () => {
    expect(stripManagedFrontmatter("---\r\nstatus: draft\r\nx: 1\r\n---\r\nText\r\n")).toBe("---\nx: 1\n---\nText\n");
  });

  it("leaves content without frontmatter unchanged", () => {
    expect(stripManagedFrontmatter("# Title\n---\nnot frontmatter\n")).toBe("# Title\n---\nnot frontmatter\n");
  });

  it("does not treat an unclosed block as frontmatter", () => {
    expect(splitFrontmatter("---\nid: x\nno end").block).toBeNull();
  });
});

describe("bodyHash", () => {
  it("is identical whatever managed values the client wrote", () => {
    const a = "---\nstatus: draft\ntitle: T\n---\nBody\n";
    const b = "---\nid: SPEC-009\nstatus: approved\ntitle: T\n---\nBody\n";
    expect(bodyHash(a)).toBe(bodyHash(b));
    expect(bodyHash(a)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes when author content changes", () => {
    expect(bodyHash("Body\n")).not.toBe(bodyHash("Body!\n"));
  });
});
