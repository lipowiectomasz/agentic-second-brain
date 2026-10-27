import type { Models } from "node-appwrite";
import { AppwriteException, ID, Query } from "node-appwrite";
import type { AuditAction, DocumentStatus, FileKind } from "@cortex/core";
import {
  kindClass,
  maxChunksPerFile,
  maxFileBytes,
  scanForSecrets,
  sectorReadPermissions,
  sectorWritePermissions,
  sha256Hex,
  stripManagedFrontmatter,
} from "@cortex/core";
import type { Caller } from "@cortex/server-kit";
import { isOrgAdmin, withTimeout } from "@cortex/server-kit";
import { chunkMarkdown, defaultChunkerOptions } from "./chunker";
import type { KnowledgeWriteDeps } from "./deps";
import { bodyOf, renderManagedFrontmatter } from "./frontmatter";
import type { WriteAction } from "./lifecycle";
import { authorSlugOf, decideWrite } from "./lifecycle";
import { mergeThreeWay } from "./merge";
import { classifyPath, titleFromContent } from "./paths";
import type { FileRow, SectorInfo } from "./store";
import { KnowledgeStore, chunksCollectionId, fileVersionsTableId, filesTableId } from "./store";
import type { DeleteInput, DeleteResult, IngestInput, IngestResult, ParsedIngestInput } from "./types";
import { KnowledgeError, deleteInputSchema, ingestInputSchema, invalidInput } from "./types";

const maxWriteAttempts = 3;

async function audit(deps: KnowledgeWriteDeps, caller: Caller, action: AuditAction, sectorId: string, target: string, detail?: string): Promise<void> {
  try {
    await deps.audit.record({ actorId: caller.userId, actorName: caller.name, channel: caller.channel, action, sectorId, target, ...(detail === undefined ? {} : { detail }) });
  } catch (error) {
    console.error("audit failed", action, error instanceof Error ? error.name : "unknown");
  }
}

function parseInput(input: IngestInput): ParsedIngestInput {
  const parsed = ingestInputSchema.safeParse(input);
  if (!parsed.success) throw invalidInput(...parsed.error.issues.map((issue) => `${issue.path.join(".")}:${issue.message}`));
  return parsed.data;
}

async function authorize(deps: KnowledgeWriteDeps, caller: Caller, sector: SectorInfo, kind: FileKind, path: string, action: WriteAction, existing: FileRow | null): Promise<void> {
  const sectorRole = sector.kind === "spine" ? null : await deps.access.getSectorRole(caller, sector.id);
  const decision = decideWrite(kind, path, action, { caller, isAdmin: isOrgAdmin(caller), sectorRole, sectorKind: sector.kind, authorSlug: authorSlugOf(caller) }, existing === null ? null : { authorId: existing.authorId, status: existing.status });
  if (!decision.allowed) {
    const error = decision.error.code === "immutable" ? { ...decision.error, docId: existing?.docId ?? null } : decision.error;
    throw new KnowledgeError(error);
  }
}

async function checkDocId(store: KnowledgeStore, deps: KnowledgeWriteDeps, caller: Caller, sectorId: string, docId: string, path: string): Promise<void> {
  const other = await store.fileByDocId(sectorId, docId);
  if (other !== null && other.path !== path) throw new KnowledgeError({ code: "doc_id_taken", docId });
  const reservations = await withTimeout("tablesDB.listRows reservation", () =>
    store.tables.listRows<Models.Row & { reservedBy: string; expiresAt: string }>({
      databaseId: store.ids.tables,
      tableId: "doc_reservations",
      queries: [Query.equal("sectorId", [sectorId]), Query.equal("docId", [docId]), Query.limit(1)],
    }),
  );
  const reservation = reservations.rows[0];
  if (reservation !== undefined && reservation.reservedBy !== caller.userId && new Date(reservation.expiresAt) > deps.now() && other === null) {
    throw new KnowledgeError({ code: "doc_id_taken", docId });
  }
}

async function validateDeclared(store: KnowledgeStore, input: ParsedIngestInput, kind: FileKind, existing: FileRow | null): Promise<{ supersedes: string | null; relatesTo: string | null }> {
  const draftEdit = existing !== null && existing.status === "draft";
  let supersedes = existing?.supersedes ?? null;
  let relatesTo = existing?.relatesTo ?? null;
  if ((kind === "spec" || kind === "backlog") && input.declared.supersedes !== undefined && (existing === null || draftEdit)) {
    const target = await store.fileByDocId(input.sectorId, input.declared.supersedes);
    if (target === null || target.kind !== kind || target.status === "superseded" || target.status === "deprecated") throw invalidInput("declared.supersedes");
    supersedes = input.declared.supersedes;
  }
  if (kind === "finding" && existing === null) {
    if (input.declared.relatesTo === undefined) throw invalidInput("declared.relatesTo:required");
    const target = await store.fileByDocId(input.sectorId, input.declared.relatesTo);
    if (target === null) throw invalidInput("declared.relatesTo");
    relatesTo = input.declared.relatesTo;
  }
  return { supersedes, relatesTo };
}

function initialStatus(kind: FileKind): DocumentStatus | null {
  if (kind === "spec" || kind === "backlog") return "draft";
  if (kind === "finding") return "approved";
  return null;
}

interface MergePlan {
  stored: string;
  status: IngestResult["status"];
  overwrittenVersion: number | null;
}

async function planContent(store: KnowledgeStore, input: ParsedIngestInput, stored: string, existing: FileRow | null): Promise<MergePlan | "unchanged"> {
  if (existing === null) return { stored, status: "created", overwrittenVersion: null };
  if (input.baseVersion !== null && input.baseVersion > existing.version) throw invalidInput("baseVersion:ahead_of_server");
  const base = (await store.versionContent(existing.id, input.baseVersion, input.baseHash)) ?? "";
  const merged = mergeThreeWay(base, existing.content, stored);
  if (merged.content === existing.content) return "unchanged";
  if (merged.overlapped) return { stored: merged.content, status: "overwritten", overwrittenVersion: existing.version };
  const fastForward = existing.content === base || input.baseHash === existing.hash;
  return { stored: merged.content, status: fastForward ? "updated" : "merged", overwrittenVersion: null };
}

function isConflict(error: unknown): boolean {
  return error instanceof AppwriteException && (error.code === 409 || error.type === "transaction_conflict");
}

export interface IngestOptions {
  auditDetail?: string;
}

export async function ingestFile(deps: KnowledgeWriteDeps, caller: Caller, rawInput: IngestInput, options: IngestOptions = {}): Promise<IngestResult> {
  const input = parseInput(rawInput);
  const bytes = Buffer.byteLength(input.content, "utf8");
  if (bytes > maxFileBytes) throw new KnowledgeError({ code: "too_large", bytes, limit: maxFileBytes });
  const store = new KnowledgeStore(deps.admin, deps.ids);
  const sector = await store.sector(input.sectorId);
  const classification = classifyPath(input.path, sector.kind);
  if ("error" in classification) throw new KnowledgeError(classification.error);
  const { kind, docId } = classification;

  const findings = scanForSecrets(input.content);
  if (findings.length > 0) {
    await audit(deps, caller, "file.rejected_secret", sector.id, input.path, findings.map((finding) => `${finding.ruleId}@${finding.line}`).join(","));
    throw new KnowledgeError({ code: "secret_detected", findings });
  }
  const incoming = stripManagedFrontmatter(input.content);

  for (let attempt = 0; attempt < maxWriteAttempts; attempt += 1) {
    const existing = await store.fileByPath(sector.id, input.path);
    if (docId !== null && kindClass[kind] !== "living") await checkDocId(store, deps, caller, sector.id, docId, input.path);
    await authorize(deps, caller, sector, kind, input.path, existing === null ? "create" : "update", existing);
    const declared = await validateDeclared(store, input, kind, existing);

    const incomingHash = sha256Hex(incoming);
    if (existing !== null && existing.hash === incomingHash && existing.supersedes === declared.supersedes) {
      return resultFor(existing, "unchanged", null, null);
    }
    const plan = await planContent(store, input, incoming, existing);
    if (plan === "unchanged") {
      if (existing === null) throw new KnowledgeError({ code: "storage_failed" });
      return resultFor(existing, "unchanged", null, renderManagedFrontmatter(existing.content, existing));
    }

    const body = bodyOf(plan.stored);
    const title = titleFromContent(body, input.path);
    const chunks = chunkMarkdown(body, defaultChunkerOptions, title);
    if (chunks.length > maxChunksPerFile) throw new KnowledgeError({ code: "too_many_chunks", chunks: chunks.length, limit: maxChunksPerFile });
    const vectors = await deps.embedder.embedDocuments(chunks.map((chunk) => ({ title, heading: chunk.heading, text: chunk.text })));

    const fileId = existing?.id ?? deps.newId();
    const hash = sha256Hex(plan.stored);
    const status = existing?.status ?? initialStatus(kind);
    const readPermissions = sectorReadPermissions(sector);
    const permissions = [...readPermissions, ...sectorWritePermissions(sector)];
    const version = (existing?.version ?? 0) + 1;

    await writeChunks(store, fileId, hash, chunks, vectors, { sectorId: sector.id, path: input.path, kind, docId: docId ?? "", status: status ?? "active" }, permissions);

    try {
      await writeRow(store, {
        fileId,
        isNew: existing === null,
        data: {
          sectorId: sector.id,
          path: input.path,
          title,
          kind,
          hash,
          version,
          size: Buffer.byteLength(plan.stored, "utf8"),
          content: plan.stored,
          updatedBy: caller.userId,
          ...(existing === null ? { authorId: caller.userId, docId, status, relatesTo: declared.relatesTo } : {}),
          supersedes: declared.supersedes,
        },
        versionData: { fileId, version, hash, content: plan.stored, authorId: caller.userId },
        permissions,
        readPermissions,
      });
    } catch (error) {
      await store.purgeOrphanChunks(fileId, existing?.hash ?? null).catch(() => 0);
      if (isConflict(error) && attempt < maxWriteAttempts - 1) continue;
      if (isConflict(error)) throw new KnowledgeError({ code: "busy" });
      throw error instanceof KnowledgeError ? error : new KnowledgeError({ code: "storage_failed" });
    }

    await store.purgeOrphanChunks(fileId, hash).catch((error: unknown) => {
      console.error("orphan purge failed", fileId, error instanceof Error ? error.name : "unknown");
      return 0;
    });

    const correction = existing !== null && kindClass[kind] === "immutable" && existing.status !== "draft" ? "admin_correction" : undefined;
    const details = [`v${version}`, status ?? "", plan.overwrittenVersion === null ? "" : `overwrote v${plan.overwrittenVersion}`, correction ?? "", options.auditDetail ?? ""].filter((part) => part !== "");
    await audit(deps, caller, "file.upserted", sector.id, input.path, details.join(" "));

    const row: FileRow = {
      ...(existing ?? emptyRow(fileId, sector.id, input.path, kind, caller.userId)),
      hash,
      version,
      content: plan.stored,
      title,
      status,
      docId: existing?.docId ?? docId,
      supersedes: declared.supersedes,
      relatesTo: existing?.relatesTo ?? declared.relatesTo,
    };
    const rendered = renderManagedFrontmatter(plan.stored, row);
    return resultFor(row, plan.status, plan.overwrittenVersion, rendered === input.content.replace(/\r\n?/g, "\n") ? null : rendered, chunks.length);
  }
  throw new KnowledgeError({ code: "busy" });
}

function emptyRow(id: string, sectorId: string, path: string, kind: FileKind, authorId: string): FileRow {
  return { id, sectorId, path, title: "", kind, hash: "", version: 0, size: 0, content: "", updatedBy: authorId, authorId, docId: null, status: null, supersedes: null, supersededBy: null, relatesTo: null, updatedAt: "" };
}

function resultFor(row: FileRow, status: IngestResult["status"], overwrittenVersion: number | null, content: string | null, chunkCount?: number): IngestResult {
  return { status, fileId: row.id, version: row.version, chunkCount: chunkCount ?? 0, docId: row.docId, docStatus: row.status, overwrittenVersion, content };
}

interface ChunkFields {
  sectorId: string;
  path: string;
  kind: FileKind;
  docId: string;
  status: string;
}

async function writeChunks(store: KnowledgeStore, fileId: string, hash: string, chunks: Array<{ index: number; heading: string; text: string }>, vectors: number[][], fields: ChunkFields, permissions: string[]): Promise<void> {
  if (chunks.length === 0) return;
  const transaction = await withTimeout("vectorsDB.createTransaction", () => store.vectors.createTransaction({ ttl: 120 }));
  try {
    for (const chunk of chunks) {
      const embeddings = vectors[chunk.index];
      if (embeddings === undefined) throw new KnowledgeError({ code: "embedding_failed" });
      await withTimeout("vectorsDB.createDocument staged", () =>
        store.vectors.createDocument({
          databaseId: store.ids.vectors,
          collectionId: chunksCollectionId,
          documentId: ID.unique(),
          data: {
            embeddings,
            metadata: { ...fields, fileId, heading: chunk.heading, chunkIndex: String(chunk.index), text: chunk.text, fileHash: hash },
          },
          permissions,
          transactionId: transaction.$id,
        }),
      );
    }
    await withTimeout("vectorsDB.commit", () => store.vectors.updateTransaction({ transactionId: transaction.$id, commit: true }));
  } catch (error) {
    await store.vectors.updateTransaction({ transactionId: transaction.$id, rollback: true }).catch(() => undefined);
    throw error instanceof KnowledgeError ? error : new KnowledgeError({ code: "storage_failed" });
  }
}

interface RowWrite {
  fileId: string;
  isNew: boolean;
  data: Record<string, unknown>;
  versionData: Record<string, unknown>;
  permissions: string[];
  readPermissions: string[];
}

async function writeRow(store: KnowledgeStore, write: RowWrite): Promise<void> {
  const transaction = await withTimeout("tablesDB.createTransaction", () => store.tables.createTransaction({ ttl: 60 }));
  try {
    const target = { databaseId: store.ids.tables, tableId: filesTableId, rowId: write.fileId, data: write.data, permissions: write.permissions, transactionId: transaction.$id };
    await withTimeout("tablesDB.stage file", () => (write.isNew ? store.tables.createRow(target) : store.tables.updateRow(target)));
    await withTimeout("tablesDB.stage version", () =>
      store.tables.createRow({ databaseId: store.ids.tables, tableId: fileVersionsTableId, rowId: ID.unique(), data: write.versionData, permissions: write.readPermissions, transactionId: transaction.$id }),
    );
    await withTimeout("tablesDB.commit", () => store.tables.updateTransaction({ transactionId: transaction.$id, commit: true }));
  } catch (error) {
    await store.tables.updateTransaction({ transactionId: transaction.$id, rollback: true }).catch(() => undefined);
    throw error;
  }
}

export async function deleteFile(deps: KnowledgeWriteDeps, caller: Caller, rawInput: DeleteInput): Promise<DeleteResult> {
  const parsed = deleteInputSchema.safeParse(rawInput);
  if (!parsed.success) throw invalidInput(...parsed.error.issues.map((issue) => issue.path.join(".")));
  const input = parsed.data;
  const store = new KnowledgeStore(deps.admin, deps.ids);
  const sector = await store.sector(input.sectorId);
  const classification = classifyPath(input.path, sector.kind);
  if ("error" in classification) throw new KnowledgeError(classification.error);
  const existing = await store.fileByPath(sector.id, input.path);
  if (existing === null) return { status: "not_found", currentVersion: null };
  await authorize(deps, caller, sector, classification.kind, input.path, "delete", existing);
  const editable = ["living", "spine", "personal"].includes(kindClass[classification.kind]);
  if (editable && existing.version !== input.baseVersion) return { status: "kept_changed", currentVersion: existing.version };

  const transaction = await withTimeout("tablesDB.createTransaction", () => store.tables.createTransaction({ ttl: 60 }));
  try {
    await store.tables.deleteRow({ databaseId: store.ids.tables, tableId: filesTableId, rowId: existing.id, transactionId: transaction.$id });
    await store.tables.deleteRows({ databaseId: store.ids.tables, tableId: fileVersionsTableId, queries: [Query.equal("fileId", [existing.id])], transactionId: transaction.$id });
    await store.tables.updateTransaction({ transactionId: transaction.$id, commit: true });
  } catch (error) {
    await store.tables.updateTransaction({ transactionId: transaction.$id, rollback: true }).catch(() => undefined);
    throw isConflict(error) ? new KnowledgeError({ code: "busy" }) : new KnowledgeError({ code: "storage_failed" });
  }
  await store.purgeOrphanChunks(existing.id, null).catch(() => 0);
  await audit(deps, caller, "file.deleted", sector.id, input.path, `v${existing.version}`);
  return { status: "deleted", currentVersion: null };
}

export async function applySpineChange(deps: KnowledgeWriteDeps, admin: Caller, input: IngestInput & { proposalId: string }): Promise<IngestResult> {
  if (!isOrgAdmin(admin)) throw new KnowledgeError({ code: "forbidden", reason: "role" });
  const store = new KnowledgeStore(deps.admin, deps.ids);
  const sector = await store.sector(input.sectorId);
  const classification = classifyPath(input.path, sector.kind);
  if ("error" in classification || kindClass[classification.kind] !== "spine") throw invalidInput("path:not_spine_document");
  const { proposalId, ...ingest } = input;
  return ingestFile(deps, admin, ingest, { auditDetail: `proposal:${proposalId}` });
}

export async function reindexFile(deps: KnowledgeWriteDeps, row: FileRow): Promise<number> {
  const store = new KnowledgeStore(deps.admin, deps.ids);
  const sector = await store.sector(row.sectorId);
  const previous = await withTimeout("vectorsDB.listDocuments reindex", () =>
    store.vectors.listDocuments({ databaseId: store.ids.vectors, collectionId: chunksCollectionId, queries: [Query.equal("metadata.fileId", [row.id]), Query.select(["$id"]), Query.limit(500)] }),
  );
  const body = bodyOf(row.content);
  const chunks = chunkMarkdown(body, defaultChunkerOptions, row.title);
  const vectors = await deps.embedder.embedDocuments(chunks.map((chunk) => ({ title: row.title, heading: chunk.heading, text: chunk.text })));
  const permissions = [...sectorReadPermissions(sector), ...sectorWritePermissions(sector)];
  await writeChunks(store, row.id, row.hash, chunks, vectors, { sectorId: row.sectorId, path: row.path, kind: row.kind, docId: row.docId ?? "", status: row.status ?? "active" }, permissions);
  const stale = previous.documents.map((document) => document.$id);
  if (stale.length > 0) {
    await withTimeout("vectorsDB.deleteDocuments reindex", () =>
      store.vectors.deleteDocuments({ databaseId: store.ids.vectors, collectionId: chunksCollectionId, queries: [Query.equal("$id", stale)] }),
    );
  }
  return chunks.length;
}
