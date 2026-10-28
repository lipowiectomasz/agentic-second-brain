import { randomBytes } from "node:crypto";
import { Account, ID, Permission, Role, TablesDB, Teams, Users } from "node-appwrite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sectorReadPermissions } from "@cortex/core";
import type { Caller } from "@cortex/server-kit";
import { createSessionClient, toCaller } from "@cortex/server-kit";
import type { KnowledgeReadDeps } from "../src";
import { KnowledgeStore, createAppwriteEmbedder, createQueryEmbeddingCache, ingestFile, readFile, related, relatedFindings, search, setDocumentStatus } from "../src";
import { admin, env, ids, stamp, writeDeps } from "./helpers";

const deps = writeDeps();
const sectors = { a: `test-sa-${stamp}`, b: `test-sb-${stamp}` };
const users: string[] = [];
let writer: Caller;
let readA: KnowledgeReadDeps;
let readB: KnowledgeReadDeps;
const files: Record<string, string> = {};

const corpus: Array<[keyof typeof sectors, string, string]> = [
  ["a", "notes/rollback.md", "# Rolling back a failed deployment\n\nWhen a release breaks production, redeploy the previous container image tag and restore the database snapshot taken before the migration.\n"],
  ["a", "notes/caching.md", "# Cache invalidation\n\nPurge the CDN cache after changing product images, otherwise customers keep seeing the old pictures for hours.\n"],
  ["a", "notes/onboarding.md", "# Onboarding a new developer\n\nGive them access to the repository, the staging environment and the password manager on the first day.\n"],
  ["b", "notes/release-revert.md", "# Reverting a broken release\n\nIf the new version crashes, switch traffic back to the last healthy build and keep the faulty one for analysis.\n"],
  ["b", "notes/invoices.md", "# Invoice numbering\n\nInvoices use a yearly counter with the prefix FV and must never have gaps.\n"],
];

async function sessionFor(name: string, teamIds: string[]): Promise<KnowledgeReadDeps> {
  const userApi = new Users(admin);
  const email = `test-${name}-${stamp}@example.com`;
  const password = randomBytes(18).toString("base64url");
  const user = await userApi.create({ userId: ID.unique(), email, password, name: `test-${name}-${stamp}` });
  users.push(user.$id);
  for (const teamId of teamIds) await new Teams(admin).createMembership({ teamId, userId: user.$id, roles: ["reader"] });
  const session = await new Account(admin).createEmailPasswordSession({ email, password });
  return { scoped: createSessionClient(env, session.secret), ids, embedder: createAppwriteEmbedder(admin), queryCache: createQueryEmbeddingCache({ maxEntries: 20, prefixMode: "none" }) };
}

beforeAll(async () => {
  const tables = new TablesDB(admin);
  for (const [key, id] of Object.entries(sectors)) {
    await new Teams(admin).create({ teamId: `sector-${id}`, name: `test-${key}-${stamp}` });
    await tables.createRow({ databaseId: ids.tables, tableId: "sectors", rowId: id, data: { slug: id, name: `Sector ${key.toUpperCase()}`, kind: "project", teamId: `sector-${id}`, color: "#1d6f70" }, permissions: [Permission.read(Role.users())] });
  }
  writer = toCaller({ $id: "test-writer", name: "test-writer", email: "writer@example.com", labels: ["admin"] }, "web");
  for (const [sector, path, content] of corpus) {
    const result = await ingestFile(deps, writer, { sectorId: sectors[sector], path, content, baseVersion: null, baseHash: null });
    files[path] = result.fileId;
  }
  readA = await sessionFor("searcha", [`sector-${sectors.a}`]);
  readB = await sessionFor("searchb", [`sector-${sectors.b}`]);
});

afterAll(async () => {
  for (const userId of users) await new Users(admin).delete({ userId }).catch(() => undefined);
  for (const id of Object.values(sectors)) {
    await new TablesDB(admin).deleteRow({ databaseId: ids.tables, tableId: "sectors", rowId: id }).catch(() => undefined);
    await new Teams(admin).delete({ teamId: `sector-${id}` }).catch(() => undefined);
  }
});

describe("semantic search", () => {
  it("finds a document described in other words within the top five", async () => {
    const results = await search(readA, { query: "how do I undo a broken release", limit: 5 });
    expect(results.map((result) => result.path)).toContain("notes/rollback.md");
    expect(results[0]).toMatchObject({ sectorName: "Sector A", anchor: "rolling-back-a-failed-deployment" });
    expect(results[0]?.similarity).toBeGreaterThan(0);
  });

  it("returns only chunks from the caller's own sectors", async () => {
    const a = await search(readA, { query: "revert a broken release", limit: 10 });
    const b = await search(readB, { query: "revert a broken release", limit: 10 });
    expect(a.every((result) => result.sectorId === sectors.a)).toBe(true);
    expect(b.every((result) => result.sectorId === sectors.b)).toBe(true);
    expect(b.map((result) => result.path)).toContain("notes/release-revert.md");
    expect(await search(readA, { query: "invoice numbering", sectorIds: [sectors.b] })).toEqual([]);
  });

  it("filters by kind and never returns orphan chunks", async () => {
    const store = new KnowledgeStore(admin, ids);
    const [vector] = await deps.embedder.embedDocuments([{ title: "Cache", heading: "Cache", text: "purge the CDN cache after image changes" }]);
    await store.vectors.createDocument({
      databaseId: ids.vectors,
      collectionId: "chunks",
      documentId: ID.unique(),
      data: { embeddings: vector, metadata: { sectorId: sectors.a, fileId: files["notes/caching.md"], path: "notes/caching.md", heading: "Cache", chunkIndex: "0", kind: "note", text: "orphan text", fileHash: "e".repeat(64), docId: "", status: "active" } },
      permissions: sectorReadPermissions({ kind: "project", teamId: `sector-${sectors.a}` }),
    });
    const results = await search(readA, { query: "purge the CDN cache", limit: 10 });
    expect(results.some((result) => result.snippet === "orphan text")).toBe(false);
    expect(await search(readA, { query: "purge the CDN cache", kinds: ["spec"] })).toEqual([]);
  });

  it("suggests related files from other documents only", async () => {
    const results = await related(readA, { fileId: files["notes/rollback.md"] ?? "" });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((result) => result.fileId !== files["notes/rollback.md"])).toBe(true);
    expect(new Set(results.map((result) => result.fileId)).size).toBe(results.length);
  });

  it("reads a file with rendered managed fields and hides unreadable files", async () => {
    const view = await readFile(readA, { fileId: files["notes/rollback.md"] ?? "" });
    expect(view).toMatchObject({ title: "Rolling back a failed deployment", kind: "note", version: 1 });
    await expect(readFile(readA, { fileId: files["notes/invoices.md"] ?? "" })).rejects.toMatchObject({ details: { code: "not_found" } });
  });

  it("hides superseded documents unless asked", async () => {
    const old = await ingestFile(deps, writer, { sectorId: sectors.a, path: "specs/SPEC-001-deploy.md", content: "# Deployment pipeline\n\nWe deploy with blue green switching of the load balancer.\n", baseVersion: null, baseHash: null });
    await setDocumentStatus(deps, writer, { sectorId: sectors.a, docId: "SPEC-001", status: "approved" });
    await ingestFile(deps, writer, { sectorId: sectors.a, path: "specs/SPEC-002-deploy.md", content: "# Deployment pipeline v2\n\nWe deploy with canary releases and automatic rollback.\n", baseVersion: null, baseHash: null, declared: { supersedes: "SPEC-001" } });
    await setDocumentStatus(deps, writer, { sectorId: sectors.a, docId: "SPEC-002", status: "approved" });
    const hidden = await search(readA, { query: "blue green load balancer deployment", limit: 10 });
    const shown = await search(readA, { query: "blue green load balancer deployment", limit: 10, includeSuperseded: true });
    expect(hidden.some((result) => result.fileId === old.fileId)).toBe(false);
    expect(shown.find((result) => result.fileId === old.fileId)).toMatchObject({ docId: "SPEC-001", status: "superseded" });
    const view = await readFile(readA, { fileId: old.fileId });
    expect(view.supersededBy).toBe("SPEC-002");
    expect(view.supersededByFileId).not.toBeNull();
    expect(view.content).toContain("superseded_by: SPEC-002");
  });

  it("links a superseding spec to its predecessor, its sector and its findings", async () => {
    const newer = await readFile(readA, { sectorId: sectors.a, path: "specs/SPEC-002-deploy.md" });
    const older = await readFile(readA, { sectorId: sectors.a, path: "specs/SPEC-001-deploy.md" });
    expect(newer).toMatchObject({ supersedes: "SPEC-001", supersedesFileId: older.fileId, sector: { name: "Sector A", color: "#1d6f70" } });
    for (const [path, content] of [
      ["docs/findings/FINDING-001-canary.md", "# Canary needs two instances\n\nA canary on one instance hides errors.\n"],
      ["docs/findings/FINDING-002-rollback.md", "# Rollback takes four minutes\n\nThe automatic rollback waits for health checks.\n"],
    ] as const) {
      await ingestFile(deps, writer, { sectorId: sectors.a, path, content, baseVersion: null, baseHash: null, declared: { relatesTo: "SPEC-002" } });
    }
    const findings = await relatedFindings(readA, { sectorId: sectors.a, docId: "SPEC-002" });
    expect(findings.map((finding) => finding.title).sort()).toEqual(["Canary needs two instances", "Rollback takes four minutes"]);
    expect(findings.every((finding) => finding.path.startsWith("docs/findings/") && finding.updatedAt !== "")).toBe(true);
    expect(await relatedFindings(readA, { sectorId: sectors.a, docId: "SPEC-001" })).toEqual([]);
    expect(await relatedFindings(readB, { sectorId: sectors.a, docId: "SPEC-002" })).toEqual([]);
    expect(await relatedFindings(readA, { sectorId: sectors.a, docId: "not an id" })).toEqual([]);
  });
});
