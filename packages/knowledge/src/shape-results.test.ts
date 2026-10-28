import GithubSlugger from "github-slugger";
import { describe, expect, it } from "vitest";
import type { FileRowSummary, RankedChunk } from "./shape-results";
import { headingAnchor, shapeResults, snippetOf } from "./shape-results";

const hash = "a".repeat(64);
const chunk = (id: string, fileId: string, distance: number, heading = "Deploy > Rollback"): RankedChunk => ({
  $id: id,
  distance,
  sectorId: "atlas",
  fileId,
  path: `${fileId}.md`,
  heading,
  chunkIndex: "0",
  kind: "note",
  text: "text",
  fileHash: hash,
  docId: "",
  status: "active",
});
const file = (overrides: Partial<FileRowSummary> = {}): FileRowSummary => ({ hash, title: "T", path: "p.md", kind: "note", sectorId: "atlas", docId: null, status: null, ...overrides });

describe("shapeResults", () => {
  const files = new Map([["f1", file()], ["f2", file({ docId: "SPEC-001", status: "approved" })]]);
  const sectors = new Map([["atlas", { name: "Atlas", color: "#1d6f70" }]]);

  it("orders by similarity, caps chunks per file and cuts to the limit", () => {
    const results = shapeResults([chunk("c3", "f1", 0.3), chunk("c1", "f1", 0.1), chunk("c2", "f1", 0.2), chunk("c4", "f2", 0.25)], files, sectors, 3);
    expect(results.map((result) => result.chunkId)).toEqual(["c1", "c2", "c4"]);
    expect(results[0]?.similarity).toBeCloseTo(0.9);
    expect(results[2]).toMatchObject({ docId: "SPEC-001", status: "approved", sectorName: "Atlas" });
  });

  it("skips chunks without a gated file and falls back to an unknown sector", () => {
    const results = shapeResults([chunk("c1", "missing", 0.1), { ...chunk("c2", "f1", 0.2), sectorId: "gone" }], files, sectors, 5);
    expect(results).toHaveLength(1);
    expect(results[0]?.sectorName).toBe("Unknown sector");
  });
});

describe("headingAnchor", () => {
  it.each(["Deploy > Rollback plan", "Setup > What's new in 2.0?", "Intro"])("matches rehype-slug ids for %s", (heading) => {
    const last = heading.split(" > ").pop() ?? heading;
    expect(headingAnchor(heading)).toBe(new GithubSlugger().slug(last));
  });
});

describe("snippetOf", () => {
  it("collapses whitespace", () => {
    expect(snippetOf("a  b\n\n c")).toBe("a b c");
  });

  it("leaves out markdown heading lines shown separately as the heading", () => {
    expect(snippetOf("# Rolling back\n\nRedeploy the previous tag.\n## Notes\nKeep the snapshot.")).toBe("Redeploy the previous tag. Keep the snapshot.");
  });

  it("keeps the heading text when the chunk has nothing else", () => {
    expect(snippetOf("## Rollback")).toBe("Rollback");
  });

  it("cuts long text at a word boundary", () => {
    const snippet = snippetOf(`${"word ".repeat(60)}end`);
    expect(snippet.length).toBeLessThanOrEqual(203);
    expect(snippet.endsWith("word...")).toBe(true);
  });
});
