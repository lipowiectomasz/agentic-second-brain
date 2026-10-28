import { describe, expect, it } from "vitest";
import type { FileEntry } from "@cortex/gateway-contract";
import { indexMarker, indexTargets, renderIndex } from "./index-file";

const entry = (path: string, docId: string | null, supersededBy: string | null = null): FileEntry => ({
  fileId: path,
  sectorId: "atlas",
  path,
  kind: docId === null ? "note" : "spec",
  version: 1,
  hash: "a".repeat(64),
  size: 1,
  title: path.split("/").at(-1) ?? path,
  updatedAt: "2026-10-28T10:00:00.000+00:00",
  meta: { docId, status: docId === null ? null : "approved", supersedes: null, supersededBy, relatesTo: null, authorId: "u1" },
});

describe("index files", () => {
  const entries = [entry("specs/SPEC-002-b.md", "SPEC-002"), entry("specs/SPEC-001-a.md", "SPEC-001", "SPEC-002"), entry("notes/n.md", null)];

  it("targets the sector root and the document folders that exist", () => {
    expect(indexTargets(entries)).toEqual([
      { dir: "", scope: "sector" },
      { dir: "specs", scope: "specs" },
    ]);
  });

  it("starts with the marker, sorts by ID and shows supersede links", () => {
    const text = renderIndex("Atlas", entries, { dir: "specs", scope: "specs" });
    expect(text.startsWith(indexMarker)).toBe(true);
    expect(text.indexOf("SPEC-001")).toBeLessThan(text.indexOf("| SPEC-002"));
    expect(text).toContain("[SPEC-001-a.md](SPEC-001-a.md) | approved | superseded by SPEC-002 |");
    expect(text).not.toContain("notes/n.md");
  });
});
