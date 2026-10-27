import type { Models } from "node-appwrite";
import { ID, Query } from "node-appwrite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bodyHash, sectorReadPermissions } from "@cortex/core";
import { KnowledgeStore, ingestFile, isChunkVisible } from "../src";
import type { Member } from "./helpers";
import { admin, cleanup, createMember, createProjectSector, ids, sectorId, teamId, writeDeps } from "./helpers";

const deps = writeDeps();
const store = new KnowledgeStore(admin, ids);
let maint: Member;
let other: Member;
let reader: Member;

const sections = Array.from({ length: 6 }, (_, index) => `## Section ${index}\n${`Paragraph ${index} about deployment, caching and retries. `.repeat(8)}`);
const base = `# Runbook\n\n${sections.join("\n\n")}\n`;

async function visibleChunks(member: Member, fileId: string) {
  const list = await member.vectors.listDocuments<Models.Document & { metadata: { fileId: string; fileHash: string; text: string } }>({
    databaseId: ids.vectors,
    collectionId: "chunks",
    queries: [Query.equal("metadata.fileId", [fileId]), Query.limit(100)],
  });
  const row = await store.fileByPath(sectorId, "notes/runbook.md");
  const files = new Map(row === null ? [] : [[row.id, { hash: row.hash }]]);
  return list.documents.filter((document) => isChunkVisible(document.metadata, files));
}

beforeAll(async () => {
  await createProjectSector();
  maint = await createMember("rmaint", { teamRole: "maintainer" });
  other = await createMember("rother", { teamRole: "maintainer" });
  reader = await createMember("rreader", { teamRole: "reader" });
});

afterAll(cleanup);

describe("ingestion resilience", () => {
  let fileId = "";

  it("keeps the previous version fully visible when a write stops after the chunks", async () => {
    const created = await ingestFile(deps, maint.caller, { sectorId, path: "notes/runbook.md", content: base, baseVersion: null, baseHash: null });
    fileId = created.fileId;
    const before = await visibleChunks(reader, fileId);
    expect(before.length).toBe(created.chunkCount);

    const [vector] = await deps.embedder.embedDocuments([{ title: "Runbook", heading: "Runbook", text: "half written update" }]);
    await store.vectors.createDocument({
      databaseId: ids.vectors,
      collectionId: "chunks",
      documentId: ID.unique(),
      data: { embeddings: vector, metadata: { sectorId, fileId, path: "notes/runbook.md", heading: "Runbook", chunkIndex: "0", kind: "note", text: "half written update", fileHash: "f".repeat(64), docId: "", status: "active" } },
      permissions: sectorReadPermissions({ kind: "project", teamId }),
    });

    const during = await visibleChunks(reader, fileId);
    expect(during.map((chunk) => chunk.$id).sort()).toEqual(before.map((chunk) => chunk.$id).sort());
    expect(during.every((chunk) => chunk.metadata.text !== "half written update")).toBe(true);
    expect((await store.fileByPath(sectorId, "notes/runbook.md"))?.hash).toBe(bodyHash(base));

    const next = await ingestFile(deps, maint.caller, { sectorId, path: "notes/runbook.md", content: base.replace("Paragraph 0", "Paragraph zero"), baseVersion: 1, baseHash: bodyHash(base) });
    expect(next.status).toBe("updated");
    const all = await store.vectors.listDocuments({ databaseId: ids.vectors, collectionId: "chunks", queries: [Query.equal("metadata.fileId", [fileId]), Query.limit(100)] });
    expect(all.total).toBe(next.chunkCount);
  });

  it("keeps both edits when two writers push from the same base at the same time", async () => {
    const row = await store.fileByPath(sectorId, "notes/runbook.md");
    if (row === null) throw new Error("missing runbook");
    const shared = { sectorId, path: "notes/runbook.md", baseVersion: row.version, baseHash: row.hash };
    const results = await Promise.all([
      ingestFile(deps, maint.caller, { ...shared, content: row.content.replace("Paragraph 1 about", "Paragraph 1 edited by the first writer about") }),
      ingestFile(deps, other.caller, { ...shared, content: row.content.replace("Paragraph 5 about", "Paragraph 5 edited by the second writer about") }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(expect.arrayContaining(["updated"]));
    const final = await store.fileByPath(sectorId, "notes/runbook.md");
    expect(final?.version).toBe(row.version + 2);
    expect(final?.content).toContain("edited by the first writer");
    expect(final?.content).toContain("edited by the second writer");
    const visible = await visibleChunks(reader, fileId);
    expect(visible.length).toBeGreaterThan(0);
    expect(new Set(visible.map((chunk) => chunk.metadata.fileHash))).toEqual(new Set([final?.hash]));
  });
});
