import { describe, expect, it } from "vitest";
import type { FileEntry, ManifestData } from "@cortex/gateway-contract";
import type { LocalFile } from "./local-files";
import { classify, revokedSectors } from "./plan";
import type { SyncState } from "./state";
import { emptyState } from "./state";

const h = (char: string) => char.repeat(64);
const sectors: ManifestData["sectors"] = [
  { id: "spine", slug: "spine", name: "Spine", kind: "spine", role: "reader" },
  { id: "atlas", slug: "atlas", name: "Atlas", kind: "project", role: "maintainer" },
  { id: "harbor", slug: "harbor", name: "Harbor", kind: "project", role: "reader" },
];

function entry(sectorId: string, path: string, hash: string, version: number, kind: FileEntry["kind"] = "note", status: FileEntry["meta"]["status"] = null): FileEntry {
  return { fileId: `${sectorId}:${path}`, sectorId, path, kind, version, hash, size: 1, title: path, updatedAt: "2026-10-28T10:00:00.000+00:00", meta: { docId: null, status, supersedes: null, supersededBy: null, relatesTo: null, authorId: "u1" } };
}

function local(path: string, hash: string): LocalFile {
  return { path, bodyHash: hash, size: 1, tooLarge: false };
}

function stateWith(files: Record<string, { hash: string; version: number; kind?: FileEntry["kind"]; status?: FileEntry["meta"]["status"] }>): SyncState {
  const state = emptyState({ endpoint: "e", projectId: "p", userId: "u1", authorSlug: "ada" });
  for (const [path, value] of Object.entries(files)) {
    state.files[path] = { fileId: path, sectorId: "atlas", version: value.version, hash: value.hash, kind: value.kind ?? "note", meta: { docId: null, status: value.status ?? null, supersedes: null, supersededBy: null, relatesTo: null, authorId: "u1" } };
  }
  return state;
}

const kinds = (changes: ReturnType<typeof classify>) => Object.fromEntries(changes.map((change) => [change.path, change.kind]));

describe("classify", () => {
  it("covers every row of the decision table", () => {
    const manifest: ManifestData = {
      authorSlug: "ada",
      sectors,
      files: [
        entry("atlas", "same.md", h("a"), 1),
        entry("atlas", "edited.md", h("b"), 1),
        entry("atlas", "remote.md", h("c"), 2),
        entry("atlas", "both.md", h("d"), 2),
        entry("atlas", "deleted.md", h("e"), 1),
        entry("atlas", "restore.md", h("f"), 2),
        entry("atlas", "new-remote.md", h("g"), 1),
        entry("atlas", "untracked.md", h("h"), 1),
      ],
    };
    const state = stateWith({
      "brains/atlas/same.md": { hash: h("a"), version: 1 },
      "brains/atlas/edited.md": { hash: h("b"), version: 1 },
      "brains/atlas/remote.md": { hash: h("x"), version: 1 },
      "brains/atlas/both.md": { hash: h("y"), version: 1 },
      "brains/atlas/deleted.md": { hash: h("e"), version: 1 },
      "brains/atlas/restore.md": { hash: h("f"), version: 1 },
      "brains/atlas/gone.md": { hash: h("z"), version: 1 },
      "brains/atlas/gone-edited.md": { hash: h("z"), version: 1 },
      "brains/atlas/vanished.md": { hash: h("z"), version: 1 },
    });
    const files = [
      local("brains/atlas/same.md", h("a")),
      local("brains/atlas/edited.md", h("1")),
      local("brains/atlas/remote.md", h("x")),
      local("brains/atlas/both.md", h("2")),
      local("brains/atlas/new.md", h("3")),
      local("brains/atlas/untracked.md", h("4")),
      local("brains/atlas/gone.md", h("z")),
      local("brains/atlas/gone-edited.md", h("5")),
    ];
    expect(kinds(classify(files, state, manifest))).toEqual({
      "brains/atlas/same.md": "unchanged",
      "brains/atlas/edited.md": "localModified",
      "brains/atlas/remote.md": "remoteModified",
      "brains/atlas/both.md": "bothModified",
      "brains/atlas/deleted.md": "localDeleted",
      "brains/atlas/restore.md": "remoteModified",
      "brains/atlas/new-remote.md": "remoteNew",
      "brains/atlas/new.md": "localNew",
      "brains/atlas/untracked.md": "bothModified",
      "brains/atlas/gone.md": "remoteDeleted",
      "brains/atlas/gone-edited.md": "localNew",
    });
  });

  it("adopts the manifest when the local body already matches it", () => {
    const manifest: ManifestData = { authorSlug: "ada", sectors, files: [entry("atlas", "a.md", h("a"), 3)] };
    expect(kinds(classify([local("brains/atlas/a.md", h("a"))], stateWith({ "brains/atlas/a.md": { hash: h("x"), version: 1 } }), manifest))["brains/atlas/a.md"]).toBe("unchanged");
  });

  it("marks approved specs and existing findings immutable and reader or foreign memory edits read-only", () => {
    const manifest: ManifestData = {
      authorSlug: "ada",
      sectors,
      files: [entry("atlas", "specs/SPEC-001-a.md", h("a"), 1, "spec", "approved"), entry("atlas", "docs/findings/FINDING-001-a.md", h("b"), 1, "finding", "approved"), entry("harbor", "notes/n.md", h("c"), 1), entry("atlas", "specs/SPEC-002-b.md", h("d"), 1, "spec", "draft")],
    };
    const state = stateWith({
      "brains/atlas/specs/SPEC-001-a.md": { hash: h("a"), version: 1, kind: "spec", status: "approved" },
      "brains/atlas/docs/findings/FINDING-001-a.md": { hash: h("b"), version: 1, kind: "finding" },
      "brains/harbor/notes/n.md": { hash: h("c"), version: 1 },
      "brains/atlas/specs/SPEC-002-b.md": { hash: h("d"), version: 1, kind: "spec", status: "draft" },
    });
    const files = [
      local("brains/atlas/specs/SPEC-001-a.md", h("1")),
      local("brains/atlas/docs/findings/FINDING-001-a.md", h("2")),
      local("brains/harbor/notes/n.md", h("3")),
      local("brains/atlas/specs/SPEC-002-b.md", h("4")),
      local("brains/atlas/memory/max/notes.md", h("5")),
      local("brains/atlas/memory/ada/notes.md", h("6")),
      local("standards/new.md", h("7")),
      local("brains/unknown/x.md", h("8")),
    ];
    expect(kinds(classify(files, state, manifest))).toEqual({
      "brains/atlas/specs/SPEC-001-a.md": "immutable",
      "brains/atlas/docs/findings/FINDING-001-a.md": "immutable",
      "brains/harbor/notes/n.md": "readOnly",
      "brains/atlas/specs/SPEC-002-b.md": "localModified",
      "brains/atlas/memory/max/notes.md": "readOnly",
      "brains/atlas/memory/ada/notes.md": "localNew",
      "standards/new.md": "readOnly",
      "brains/unknown/x.md": "unknownSector",
    });
  });

  it("lists project sectors that disappeared from the manifest", () => {
    const state = stateWith({});
    state.sectors = { spine: { id: "spine", kind: "spine" }, atlas: { id: "atlas", kind: "project" }, orion: { id: "orion", kind: "project" } };
    expect(revokedSectors(state, { authorSlug: "ada", sectors, files: [] })).toEqual(["orion"]);
  });
});
