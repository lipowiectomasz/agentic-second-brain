import type { Models } from "node-appwrite";
import { Query } from "node-appwrite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bodyHash } from "@cortex/core";
import { KnowledgeError, KnowledgeStore, deleteFile, ingestFile, reindexFile, reserveDocId, setDocumentStatus } from "../src";
import type { Member } from "./helpers";
import { admin, audit, cleanup, createMember, createProjectSector, ids, sectorId, writeDeps } from "./helpers";

const deps = writeDeps();
const store = new KnowledgeStore(admin, ids);
let boss: Member;
let maint: Member;
let other: Member;
let reader: Member;
let outsider: Member;

const agents = "# Module\n\n## Overview\nThe sync module copies files between machines and the brain.\n\n## Commands\nRun pull at session start and push at session end.\n\n## Limits\nFiles over 256 KB are refused.\n";

async function chunksOf(fileId: string) {
  const list = await store.vectors.listDocuments<Models.Document & { metadata: Record<string, string> }>({
    databaseId: ids.vectors,
    collectionId: "chunks",
    queries: [Query.equal("metadata.fileId", [fileId]), Query.limit(100)],
  });
  return list.documents;
}

async function expectError(promise: Promise<unknown>, code: string, reason?: string) {
  const error = await promise.then(() => null, (caught: unknown) => caught);
  expect(error).toBeInstanceOf(KnowledgeError);
  expect((error as KnowledgeError).details.code).toBe(code);
  if (reason !== undefined) expect((error as KnowledgeError).details).toMatchObject({ reason });
}

beforeAll(async () => {
  await createProjectSector();
  boss = await createMember("boss", { admin: true });
  maint = await createMember("maint", { teamRole: "maintainer" });
  other = await createMember("other", { teamRole: "maintainer" });
  reader = await createMember("reader", { teamRole: "reader", local: "kreader" });
  outsider = await createMember("outsider");
});

afterAll(cleanup);

describe("ingestFile", () => {
  let fileId = "";

  it("creates a file with versioned row, chunks and sector permissions", async () => {
    const result = await ingestFile(deps, maint.caller, { sectorId, path: "mirror/sync/AGENTS.md", content: agents, baseVersion: null, baseHash: null });
    expect(result).toMatchObject({ status: "created", version: 1, docId: null, docStatus: null });
    fileId = result.fileId;
    const row = await store.fileByPath(sectorId, "mirror/sync/AGENTS.md");
    expect(row).toMatchObject({ kind: "module", version: 1, hash: bodyHash(agents), authorId: maint.caller.userId });
    const chunks = await chunksOf(fileId);
    expect(chunks.length).toBe(result.chunkCount);
    expect(chunks[0]?.metadata).toMatchObject({ sectorId, fileId, kind: "module", status: "active", docId: "", fileHash: bodyHash(agents) });
    expect(chunks[0]?.$permissions).toContain(`read("team:sector-${sectorId}")`);
    expect(await store.versionContent(fileId, 1, null)).toBe(agents);
  });

  it("returns unchanged for the same body even with other managed frontmatter", async () => {
    const result = await ingestFile(deps, maint.caller, { sectorId, path: "mirror/sync/AGENTS.md", content: `---\nstatus: approved\n---\n${agents}`, baseVersion: 1, baseHash: bodyHash(agents) });
    expect(result.status).toBe("unchanged");
    expect(result.version).toBe(1);
  });

  it("merges disjoint edits from the same base and overwrites on overlap with history", async () => {
    const base = { baseVersion: 1, baseHash: bodyHash(agents) };
    const first = await ingestFile(deps, maint.caller, { sectorId, path: "mirror/sync/AGENTS.md", content: agents.replace("copies files", "copies Markdown files"), ...base });
    expect(first.status).toBe("updated");
    const second = await ingestFile(deps, other.caller, { sectorId, path: "mirror/sync/AGENTS.md", content: agents.replace("are refused.", "are refused with a clear message."), ...base });
    expect(second.status).toBe("merged");
    expect(second.content).toContain("copies Markdown files");
    expect(second.content).toContain("with a clear message");
    const third = await ingestFile(deps, other.caller, { sectorId, path: "mirror/sync/AGENTS.md", content: agents.replace("copies files", "moves files"), ...base });
    expect(third).toMatchObject({ status: "overwritten", overwrittenVersion: 3 });
    expect(await store.versionContent(fileId, 3, null)).toContain("copies Markdown files");
    const chunks = await chunksOf(fileId);
    expect(new Set(chunks.map((chunk) => chunk.metadata.fileHash))).toEqual(new Set([(await store.fileByPath(sectorId, "mirror/sync/AGENTS.md"))?.hash]));
  });

  it("hides the file from members outside the team", async () => {
    const own = await outsider.vectors.listDocuments({ databaseId: ids.vectors, collectionId: "chunks", queries: [Query.equal("metadata.fileId", [fileId])] });
    const team = await reader.vectors.listDocuments({ databaseId: ids.vectors, collectionId: "chunks", queries: [Query.equal("metadata.fileId", [fileId])] });
    expect(own.total).toBe(0);
    expect(team.total).toBeGreaterThan(0);
  });

  it("refuses readers, secrets, oversized files and the spine for non-admins", async () => {
    await expectError(ingestFile(deps, reader.caller, { sectorId, path: "notes/a.md", content: "# A\n", baseVersion: null, baseHash: null }), "forbidden", "role");
    await expectError(ingestFile(deps, maint.caller, { sectorId, path: "notes/leak.md", content: "# Keys\nAKIAIOSFODNN7EXAMPLE\n", baseVersion: null, baseHash: null }), "secret_detected");
    expect(audit.events.some((event) => event.action === "file.rejected_secret")).toBe(true);
    await expectError(ingestFile(deps, maint.caller, { sectorId, path: "notes/big.md", content: "x".repeat(262145), baseVersion: null, baseHash: null }), "too_large");
    await expectError(ingestFile(deps, maint.caller, { sectorId: "spine", path: "standards/x.md", content: "# X\n", baseVersion: null, baseHash: null }), "forbidden", "spine_requires_proposal");
  });

  it("lets members write only their own memory", async () => {
    const own = await ingestFile(deps, reader.caller, { sectorId, path: "memory/kreader/notes.md", content: "# Notes\nRemember the cache.\n", baseVersion: null, baseHash: null });
    expect(own.status).toBe("created");
    await expectError(ingestFile(deps, reader.caller, { sectorId, path: "memory/someone-else/notes.md", content: "# Notes\n", baseVersion: null, baseHash: null }), "forbidden", "memory_owner");
  });

  it("keeps a changed living file on delete and deletes an unchanged one", async () => {
    expect(await deleteFile(deps, maint.caller, { sectorId, path: "mirror/sync/AGENTS.md", baseVersion: 1 })).toMatchObject({ status: "kept_changed", currentVersion: 4 });
    expect(await deleteFile(deps, maint.caller, { sectorId, path: "mirror/sync/AGENTS.md", baseVersion: 4 })).toMatchObject({ status: "deleted" });
    expect(await store.fileByPath(sectorId, "mirror/sync/AGENTS.md")).toBeNull();
    expect(await chunksOf(fileId)).toHaveLength(0);
    expect(await store.versionContent(fileId, 1, null)).toBeNull();
  });
});

describe("document lifecycle", () => {
  it("reserves distinct ids under concurrency", async () => {
    const reservations = await Promise.all(Array.from({ length: 10 }, () => reserveDocId(deps, maint.caller, { sectorId, kind: "spec" })));
    expect(new Set(reservations.map((reservation) => reservation.docId)).size).toBe(10);
  });

  it("keeps approved specs immutable, drafts author-only and supersedes on approval", async () => {
    const spec = await ingestFile(deps, maint.caller, { sectorId, path: "specs/SPEC-001-sync.md", content: "# Sync\nFirst version of the sync design.\n", baseVersion: null, baseHash: null });
    expect(spec).toMatchObject({ status: "created", docId: "SPEC-001", docStatus: "draft" });
    expect(spec.content).toContain("id: SPEC-001");
    await expectError(ingestFile(deps, other.caller, { sectorId, path: "specs/SPEC-001-sync.md", content: "# Sync\nHijacked.\n", baseVersion: 1, baseHash: null }), "not_author");
    await setDocumentStatus(deps, maint.caller, { sectorId, docId: "SPEC-001", status: "approved" });
    await expectError(ingestFile(deps, maint.caller, { sectorId, path: "specs/SPEC-001-sync.md", content: "# Sync\nChanged after approval.\n", baseVersion: 1, baseHash: null }), "immutable");

    const correction = await ingestFile(deps, boss.caller, { sectorId, path: "specs/SPEC-001-sync.md", content: "# Sync\nFirst version of the sync design, typo fixed.\n", baseVersion: 1, baseHash: null });
    expect(correction).toMatchObject({ status: "updated", docStatus: "approved", version: 2 });

    const next = await ingestFile(deps, maint.caller, { sectorId, path: "specs/SPEC-002-sync-v2.md", content: "# Sync v2\nReplaces the first design.\n", baseVersion: null, baseHash: null, declared: { supersedes: "SPEC-001" } });
    expect(next.content).toContain("supersedes: SPEC-001");
    expect(await setDocumentStatus(deps, maint.caller, { sectorId, docId: "SPEC-002", status: "approved" })).toMatchObject({ superseded: "SPEC-001" });
    const old = await store.fileByDocId(sectorId, "SPEC-001");
    expect(old).toMatchObject({ status: "superseded", supersededBy: "SPEC-002" });
    const oldChunks = await chunksOf(old?.id ?? "");
    expect(oldChunks.every((chunk) => chunk.metadata.status === "superseded")).toBe(true);
    await expectError(setDocumentStatus(deps, maint.caller, { sectorId, docId: "SPEC-002", status: "implemented" }), "invalid_transition");
  });

  it("creates findings once with a related document", async () => {
    await expectError(ingestFile(deps, maint.caller, { sectorId, path: "docs/findings/FINDING-001-limits.md", content: "# Limits\n", baseVersion: null, baseHash: null }), "invalid_input");
    const finding = await ingestFile(deps, maint.caller, { sectorId, path: "docs/findings/FINDING-001-limits.md", content: "# Limits\nTransactions cap at 100 operations.\n", baseVersion: null, baseHash: null, declared: { relatesTo: "SPEC-002" } });
    expect(finding).toMatchObject({ docId: "FINDING-001", docStatus: "approved" });
    await expectError(ingestFile(deps, maint.caller, { sectorId, path: "docs/findings/FINDING-001-limits.md", content: "# Limits\nEdited.\n", baseVersion: 1, baseHash: null }), "immutable");
  });

  it("reindexes a file without duplicating chunks or changing the version", async () => {
    const row = await store.fileByDocId(sectorId, "FINDING-001");
    if (row === null) throw new Error("missing finding");
    const before = await chunksOf(row.id);
    const count = await reindexFile(deps, row);
    const after = await chunksOf(row.id);
    expect(after).toHaveLength(count);
    expect(after.map((chunk) => chunk.$id)).not.toEqual(before.map((chunk) => chunk.$id));
    expect((await store.fileByDocId(sectorId, "FINDING-001"))?.version).toBe(row.version);
  });
});
