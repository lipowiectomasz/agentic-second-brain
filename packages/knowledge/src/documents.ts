import type { Models } from "node-appwrite";
import { AppwriteException, ID, Query } from "node-appwrite";
import type { DocumentStatus } from "@cortex/core";
import { docIdPrefix, sectorReadPermissions, sectorWritePermissions } from "@cortex/core";
import type { Caller } from "@cortex/server-kit";
import { isOrgAdmin, withTimeout } from "@cortex/server-kit";
import type { KnowledgeWriteDeps } from "./deps";
import { authorSlugOf, decideTransition, decideWrite } from "./lifecycle";
import type { FileRow } from "./store";
import { KnowledgeStore, chunksCollectionId, filesTableId, reservationsTableId } from "./store";
import type { Reservation, ReserveInput, StatusInput, StatusResult } from "./types";
import { KnowledgeError, invalidInput, reserveInputSchema, statusInputSchema } from "./types";

const reservationDays = 7;
const maxReservationAttempts = 15;

export function formatDocId(prefix: string, number: number): string {
  return `${prefix}-${String(number).padStart(3, "0")}`;
}

export function docNumber(docId: string): number {
  return Number(docId.split("-").pop() ?? "0");
}

async function highestNumber(store: KnowledgeStore, tableId: string, sectorId: string, prefix: string): Promise<number> {
  const list = await withTimeout("tablesDB.listRows doc ids", () =>
    store.tables.listRows<Models.Row & { docId?: string | null }>({
      databaseId: store.ids.tables,
      tableId,
      queries: [Query.equal("sectorId", [sectorId]), Query.startsWith("docId", `${prefix}-`), Query.select(["docId"]), Query.limit(500)],
    }),
  );
  return list.rows.reduce((max, row) => Math.max(max, row.docId === undefined || row.docId === null ? 0 : docNumber(row.docId)), 0);
}

export async function reserveDocId(deps: KnowledgeWriteDeps, caller: Caller, rawInput: ReserveInput): Promise<Reservation> {
  const parsed = reserveInputSchema.safeParse(rawInput);
  if (!parsed.success) throw invalidInput("reserve");
  const input = parsed.data;
  const store = new KnowledgeStore(deps.admin, deps.ids);
  const sector = await store.sector(input.sectorId);
  if (sector.kind === "spine") throw invalidInput("kind_not_allowed_in_sector");
  const sectorRole = await deps.access.getSectorRole(caller, sector.id);
  const decision = decideWrite(input.kind, "", "create", { caller, isAdmin: isOrgAdmin(caller), sectorRole, sectorKind: sector.kind, authorSlug: authorSlugOf(caller) }, null);
  if (!decision.allowed) throw new KnowledgeError(decision.error);

  const prefix = docIdPrefix[input.kind];
  const highest = async () => Math.max(await highestNumber(store, filesTableId, sector.id, prefix), await highestNumber(store, reservationsTableId, sector.id, prefix));
  const expiresAt = new Date(deps.now().getTime() + reservationDays * 86_400_000).toISOString();
  let candidate = (await highest()) + 1;
  for (let attempt = 0; attempt < maxReservationAttempts; attempt += 1) {
    const docId = formatDocId(prefix, candidate);
    try {
      await withTimeout("tablesDB.createRow reservation", () =>
        store.tables.createRow({
          databaseId: store.ids.tables,
          tableId: reservationsTableId,
          rowId: ID.unique(),
          data: { sectorId: sector.id, docId, kind: input.kind, reservedBy: caller.userId, expiresAt },
          permissions: [...sectorReadPermissions(sector)],
        }),
      );
      return { docId, expiresAt };
    } catch (error) {
      if (!(error instanceof AppwriteException && error.code === 409)) throw error;
      candidate = Math.max(candidate + 1, (await highest()) + 1);
    }
  }
  throw new KnowledgeError({ code: "busy" });
}

async function updateChunkStatus(store: KnowledgeStore, file: FileRow, status: DocumentStatus): Promise<void> {
  const list = await withTimeout("vectorsDB.listDocuments chunks", () =>
    store.vectors.listDocuments<Models.Document & { metadata: Record<string, unknown> }>({
      databaseId: store.ids.vectors,
      collectionId: chunksCollectionId,
      queries: [Query.equal("metadata.fileId", [file.id]), Query.select(["$id", "metadata"]), Query.limit(100)],
    }),
  );
  if (list.documents.length === 0) return;
  const transaction = await store.vectors.createTransaction({ ttl: 120 });
  try {
    for (const document of list.documents) {
      await store.vectors.updateDocument({
        databaseId: store.ids.vectors,
        collectionId: chunksCollectionId,
        documentId: document.$id,
        data: { metadata: { ...document.metadata, status } },
        transactionId: transaction.$id,
      });
    }
    await store.vectors.updateTransaction({ transactionId: transaction.$id, commit: true });
  } catch (error) {
    await store.vectors.updateTransaction({ transactionId: transaction.$id, rollback: true }).catch(() => undefined);
    console.error("chunk status update failed", file.id, error instanceof Error ? error.name : "unknown");
  }
}

export async function setDocumentStatus(deps: KnowledgeWriteDeps, caller: Caller, rawInput: StatusInput): Promise<StatusResult> {
  const parsed = statusInputSchema.safeParse(rawInput);
  if (!parsed.success) throw invalidInput("status");
  const input = parsed.data;
  const store = new KnowledgeStore(deps.admin, deps.ids);
  const sector = await store.sector(input.sectorId);
  const row = await store.fileByDocId(sector.id, input.docId);
  if (row === null) throw new KnowledgeError({ code: "doc_not_found" });
  if (caller.channel === "token" && caller.tokenScope !== "write") throw new KnowledgeError({ code: "forbidden", reason: "token_scope" });
  const sectorRole = sector.kind === "spine" ? null : await deps.access.getSectorRole(caller, sector.id);
  if (!(isOrgAdmin(caller) || sectorRole === "maintainer" || row.authorId === caller.userId)) throw new KnowledgeError({ code: "forbidden", reason: "role" });
  const decision = decideTransition(row.kind, row.status, input.status);
  if (!decision.allowed) throw new KnowledgeError(decision.error);

  const target = input.status === "approved" && row.supersedes !== null ? await store.fileByDocId(sector.id, row.supersedes) : null;
  if (input.status === "approved" && row.supersedes !== null && (target === null || target.status === "superseded" || target.status === "deprecated")) {
    throw new KnowledgeError({ code: "invalid_transition", from: row.status, to: input.status });
  }

  const permissions = [...sectorReadPermissions(sector), ...sectorWritePermissions(sector)];
  const transaction = await store.tables.createTransaction({ ttl: 60 });
  try {
    await store.tables.updateRow({ databaseId: store.ids.tables, tableId: filesTableId, rowId: row.id, data: { status: input.status }, permissions, transactionId: transaction.$id });
    if (target !== null) {
      await store.tables.updateRow({ databaseId: store.ids.tables, tableId: filesTableId, rowId: target.id, data: { status: "superseded", supersededBy: row.docId }, permissions, transactionId: transaction.$id });
    }
    await store.tables.updateTransaction({ transactionId: transaction.$id, commit: true });
  } catch (error) {
    await store.tables.updateTransaction({ transactionId: transaction.$id, rollback: true }).catch(() => undefined);
    throw error instanceof AppwriteException && error.code === 409 ? new KnowledgeError({ code: "busy" }) : new KnowledgeError({ code: "storage_failed" });
  }

  await updateChunkStatus(store, row, input.status);
  if (target !== null) await updateChunkStatus(store, target, "superseded");
  try {
    await deps.audit.record({
      actorId: caller.userId,
      actorName: caller.name,
      channel: caller.channel,
      action: "document.status_changed",
      sectorId: sector.id,
      target: input.docId,
      detail: `${row.status ?? "none"}->${input.status}${target === null ? "" : ` superseded ${target.docId ?? ""}`}`,
    });
  } catch (error) {
    console.error("audit failed", error instanceof Error ? error.name : "unknown");
  }
  return { docId: input.docId, status: input.status, superseded: target?.docId ?? null };
}
