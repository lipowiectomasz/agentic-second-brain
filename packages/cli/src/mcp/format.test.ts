import { describe, expect, it } from "vitest";
import { formatHits, pageContent, toHits } from "./format";

const hit = { sectorId: "s1", sectorName: "Atlas", fileId: "f1", path: "notes/rollback.md", title: "Rollback", kind: "note" as const, heading: "Rollback > Steps", snippet: "Redeploy the previous tag.", similarity: 0.8234, docId: "SPEC-001", status: "approved" };

describe("MCP formatting", () => {
  it("renders sector slug, path, heading, document and similarity with two decimals in order", () => {
    const hits = toHits([hit, { ...hit, fileId: "f2", docId: null, status: "active", similarity: 0.5 }], new Map([["s1", "atlas"]]));
    const formatted = formatHits(hits);
    expect(formatted.text).toContain("1. [atlas] notes/rollback.md > Rollback > Steps [SPEC-001 approved] (similarity 0.82)");
    expect(formatted.text).toContain("2. [atlas] notes/rollback.md > Rollback > Steps (similarity 0.50)");
    expect(formatted.structured.results.map((entry) => entry.fileId)).toEqual(["f1", "f2"]);
    expect(formatted.structured.results[1]?.status).toBeNull();
  });

  it("says so when nothing matches", () => {
    expect(formatHits([]).text).toContain("No matching knowledge");
  });

  it("pages long content at newlines and ends with a null offset", () => {
    const content = Array.from({ length: 30 }, (_, index) => `line ${index} ${"x".repeat(10)}`).join("\n");
    const pages: string[] = [];
    let offset: number | null = 0;
    while (offset !== null) {
      const page = pageContent(content, offset, 100);
      pages.push(page.slice);
      if (page.nextOffset !== null) expect(page.slice.endsWith("\n")).toBe(true);
      offset = page.nextOffset;
    }
    expect(pages.join("")).toBe(content);
    expect(pages.length).toBeGreaterThan(3);
  });
});
