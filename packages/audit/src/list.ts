import type { Models, TablesDB } from "node-appwrite";
import { Query } from "node-appwrite";
import { z } from "zod";
import type { AuditEvent } from "@cortex/core";
import { auditActions } from "@cortex/core";
import { withTimeout } from "@cortex/server-kit";
import { auditEventsTableId } from "./sink";

const idPattern = /^[a-zA-Z0-9._-]{1,36}$/;

export const auditFilterSchema = z.object({
  actorId: z.string().regex(idPattern).optional(),
  sectorId: z.string().regex(idPattern).optional(),
  action: z.enum(auditActions).optional(),
  cursor: z.string().regex(idPattern).optional(),
});

export type AuditFilter = z.infer<typeof auditFilterSchema>;

export interface AuditRow extends AuditEvent {
  id: string;
  createdAt: string;
}

type Row = Models.Row & AuditEvent & { sectorId: string | null; detail: string | null };

export const auditPageSize = 50;

export async function listAuditEvents(sessionTables: Pick<TablesDB, "listRows">, ids: { tables: string }, filter: AuditFilter): Promise<{ events: AuditRow[]; nextCursor: string | null }> {
  const queries = [Query.orderDesc("$createdAt"), Query.orderDesc("$id"), Query.limit(auditPageSize + 1)];
  if (filter.actorId !== undefined) queries.push(Query.equal("actorId", [filter.actorId]));
  if (filter.sectorId !== undefined) queries.push(Query.equal("sectorId", [filter.sectorId]));
  if (filter.action !== undefined) queries.push(Query.equal("action", [filter.action]));
  if (filter.cursor !== undefined) queries.push(Query.cursorAfter(filter.cursor));
  const list = await withTimeout("tablesDB.listRows audit", () => sessionTables.listRows<Row>({ databaseId: ids.tables, tableId: auditEventsTableId, queries }));
  const rows = list.rows.slice(0, auditPageSize).map((row) => ({
    id: row.$id,
    createdAt: row.$createdAt,
    actorId: row.actorId,
    actorName: row.actorName,
    action: row.action,
    channel: row.channel,
    target: row.target,
    ...(row.sectorId === null ? {} : { sectorId: row.sectorId }),
    ...(row.detail === null ? {} : { detail: row.detail }),
  }));
  return { events: rows, nextCursor: list.rows.length > auditPageSize ? (rows.at(-1)?.id ?? null) : null };
}
