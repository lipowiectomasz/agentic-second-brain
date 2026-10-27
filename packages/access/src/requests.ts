import type { Models, TablesDB } from "node-appwrite";
import { ID, Permission, Query, Role } from "node-appwrite";
import type { SectorRole } from "@cortex/core";
import { adminLabel } from "@cortex/core";
import type { Caller } from "@cortex/server-kit";
import { ForbiddenError, withTimeout } from "@cortex/server-kit";
import { recordAudit } from "./audit";
import { AlreadyMemberError, RequestAlreadyDecidedError, RequestPendingError, SectorNotFoundError } from "./errors";
import { accessRequestsTableId } from "./requests-table";
import { applyRole, roleInSector } from "./roles";
import { canDecideRequest } from "./rules";
import { getSectorRow, listSectorRows } from "./sector-rows";
import type { AccessDeps, AccessRequestInput, PendingRequest, RequestDecision } from "./types";

interface RequestRowData {
  userId: string;
  userName: string;
  sectorId: string;
  role: SectorRole;
  status: "pending" | "approved" | "rejected";
  message?: string | null;
}

export async function requestAccess(caller: Caller, input: AccessRequestInput, deps: AccessDeps): Promise<void> {
  const sector = await getSectorRow(deps, input.sectorId);
  if (sector.kind === "spine") throw new SectorNotFoundError(input.sectorId);
  if ((await roleInSector(deps, sector, caller.userId)) !== null) throw new AlreadyMemberError();
  const pending = await withTimeout("tablesDB.listRows pending", () =>
    deps.admin.tables.listRows({
      databaseId: deps.ids.tables,
      tableId: accessRequestsTableId,
      queries: [Query.equal("sectorId", [sector.id]), Query.equal("userId", [caller.userId]), Query.equal("status", ["pending"]), Query.limit(1)],
    }),
  );
  if (pending.rows.length > 0) throw new RequestPendingError();
  await withTimeout("tablesDB.createRow request", () =>
    deps.admin.tables.createRow({
      databaseId: deps.ids.tables,
      tableId: accessRequestsTableId,
      rowId: ID.unique(),
      data: { userId: caller.userId, userName: caller.name, sectorId: sector.id, role: input.role, status: "pending", message: input.message ?? null },
      permissions: [
        Permission.read(Role.user(caller.userId)),
        Permission.read(Role.team(sector.teamId, "maintainer")),
        Permission.read(Role.label(adminLabel)),
      ],
    }),
  );
  await recordAudit(deps, caller, { action: "access.requested", sectorId: sector.id, target: `user:${caller.userId}`, detail: input.role });
}

export async function listPendingRequests(caller: Caller, sessionTables: TablesDB, deps: AccessDeps): Promise<PendingRequest[]> {
  const [list, sectors] = await Promise.all([
    withTimeout("tablesDB.listRows pending for reviewer", () =>
      sessionTables.listRows<Models.Row & RequestRowData>({
        databaseId: deps.ids.tables,
        tableId: accessRequestsTableId,
        queries: [Query.equal("status", ["pending"]), Query.orderAsc("$createdAt"), Query.limit(100)],
      }),
    ),
    listSectorRows(sessionTables, deps.ids.tables),
  ]);
  const byId = new Map(sectors.map((sector) => [sector.id, sector]));
  return list.rows
    .filter((row) => row.userId !== caller.userId)
    .map((row) => {
      const sector = byId.get(row.sectorId);
      return {
        id: row.$id,
        userName: row.userName,
        sector: { id: row.sectorId, name: sector?.name ?? row.sectorId, color: sector?.color ?? "#808080" },
        role: row.role,
        message: row.message ?? null,
        createdAt: row.$createdAt,
      };
    });
}

export async function decideRequest(caller: Caller, input: RequestDecision, deps: AccessDeps): Promise<void> {
  const row = await withTimeout("tablesDB.getRow request", () =>
    deps.admin.tables.getRow<Models.Row & RequestRowData>({ databaseId: deps.ids.tables, tableId: accessRequestsTableId, rowId: input.requestId }),
  );
  if (row.status !== "pending") throw new RequestAlreadyDecidedError();
  const sector = await getSectorRow(deps, row.sectorId);
  const actorRole = await roleInSector(deps, sector, caller.userId);
  if (!canDecideRequest(caller, actorRole, row.role)) throw new ForbiddenError("cannot_decide");
  if (input.decision === "approve") {
    await applyRole(deps, sector, row.userId, row.role);
  }
  await withTimeout("tablesDB.updateRow request", () =>
    deps.admin.tables.updateRow({
      databaseId: deps.ids.tables,
      tableId: accessRequestsTableId,
      rowId: row.$id,
      data: { status: input.decision === "approve" ? "approved" : "rejected", decidedBy: caller.userId, decidedAt: new Date().toISOString() },
    }),
  );
  await recordAudit(deps, caller, {
    action: input.decision === "approve" ? "access.approved" : "access.rejected",
    sectorId: sector.id,
    target: `user:${row.userId}`,
    detail: row.role,
  });
}
