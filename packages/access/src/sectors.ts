import type { Models, TablesDB } from "node-appwrite";
import { AppwriteException, Permission, Query, Role } from "node-appwrite";
import type { SectorRole } from "@cortex/core";
import { sectorColorHex, sectorTeamId } from "@cortex/core";
import type { Caller } from "@cortex/server-kit";
import { ForbiddenError, isOrgAdmin, withTimeout } from "@cortex/server-kit";
import { recordAudit } from "./audit";
import { SlugTakenError } from "./errors";
import { roleFromTeamRoles } from "./rules";
import { listSectorRows, sectorsTableId } from "./sector-rows";
import { accessRequestsTableId } from "./requests-table";
import type { AccessDeps, SectorInput, SectorRow, SectorSummary, SectorView } from "./types";

async function membershipRolesByTeam(deps: AccessDeps, userId: string): Promise<Map<string, SectorRole>> {
  const list = await withTimeout("users.listMemberships", () => deps.admin.users.listMemberships({ userId, queries: [Query.limit(100)] }));
  return new Map(list.memberships.map((membership) => [membership.teamId, roleFromTeamRoles(membership.roles)]));
}

interface RequestRow {
  sectorId: string;
  status: "pending" | "approved" | "rejected";
  decidedAt?: string | null;
}

async function latestRequests(sessionTables: TablesDB, deps: AccessDeps, userId: string): Promise<Map<string, SectorView["myRequest"]>> {
  const list = await withTimeout("tablesDB.listRows own requests", () =>
    sessionTables.listRows<Models.Row & RequestRow>({
      databaseId: deps.ids.tables,
      tableId: accessRequestsTableId,
      queries: [Query.equal("userId", [userId]), Query.orderDesc("$createdAt"), Query.limit(100)],
    }),
  );
  const result = new Map<string, SectorView["myRequest"]>();
  for (const row of list.rows) {
    if (result.has(row.sectorId) || row.status === "approved") continue;
    result.set(row.sectorId, { status: row.status, decidedAt: row.decidedAt ?? null });
  }
  return result;
}

function toView(sector: SectorRow, myRole: SectorView["myRole"], myRequest: SectorView["myRequest"]): SectorView {
  return { id: sector.id, slug: sector.slug, name: sector.name, kind: sector.kind, color: sector.color, description: sector.description, myRole, myRequest };
}

export async function listSectorsForCaller(caller: Caller, sessionTables: TablesDB, deps: AccessDeps): Promise<SectorView[]> {
  const [rows, roles, requests] = await Promise.all([
    listSectorRows(sessionTables, deps.ids.tables),
    membershipRolesByTeam(deps, caller.userId),
    latestRequests(sessionTables, deps, caller.userId),
  ]);
  return rows.map((sector) => {
    const myRole = sector.kind === "spine" ? "spine-reader" : (roles.get(sector.teamId) ?? null);
    return toView(sector, myRole, myRole === null ? (requests.get(sector.id) ?? null) : null);
  });
}

export async function listMySectors(caller: Caller, sessionTables: TablesDB, deps: AccessDeps): Promise<SectorView[]> {
  return (await listSectorsForCaller(caller, sessionTables, deps)).filter((sector) => sector.myRole !== null);
}

export async function listSectorSummaries(caller: Caller, deps: AccessDeps): Promise<SectorSummary[]> {
  if (!isOrgAdmin(caller)) throw new ForbiddenError("not_admin");
  const rows = await listSectorRows(deps.admin.tables, deps.ids.tables);
  return Promise.all(
    rows.map(async (sector) => {
      const [files, latest, team] = await Promise.all([
        withTimeout("tablesDB.listRows files count", () =>
          deps.admin.tables.listRows({ databaseId: deps.ids.tables, tableId: "files", queries: [Query.equal("sectorId", [sector.id]), Query.limit(1), Query.select(["$id"])], total: true }),
        ),
        withTimeout("tablesDB.listRows files latest", () =>
          deps.admin.tables.listRows({ databaseId: deps.ids.tables, tableId: "files", queries: [Query.equal("sectorId", [sector.id]), Query.orderDesc("$updatedAt"), Query.limit(1), Query.select(["$id", "$updatedAt"])] }),
        ),
        withTimeout("teams.get", () => deps.admin.teams.get({ teamId: sector.teamId })).catch((error: unknown) => {
          if (error instanceof AppwriteException && error.code === 404) return { total: 0 };
          throw error;
        }),
      ]);
      return {
        ...toView(sector, sector.kind === "spine" ? "spine-reader" : null, null),
        fileCount: files.total,
        memberCount: team.total,
        lastChangeAt: latest.rows[0]?.$updatedAt ?? null,
      };
    }),
  );
}

export async function createSector(caller: Caller, input: SectorInput, deps: AccessDeps): Promise<SectorView> {
  if (!isOrgAdmin(caller)) throw new ForbiddenError("not_admin");
  const teamId = sectorTeamId(input.slug);
  try {
    await withTimeout("teams.create", () => deps.admin.teams.create({ teamId, name: input.name, roles: ["maintainer", "reader"] }));
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 409) throw new SlugTakenError(input.slug);
    throw error;
  }
  const data = { slug: input.slug, name: input.name, kind: "project" as const, teamId, color: sectorColorHex(input.color), description: input.description ?? null };
  try {
    await withTimeout("tablesDB.createRow sector", () =>
      deps.admin.tables.createRow({ databaseId: deps.ids.tables, tableId: sectorsTableId, rowId: input.slug, data, permissions: [Permission.read(Role.users())] }),
    );
  } catch (error) {
    await withTimeout("teams.delete compensation", () => deps.admin.teams.delete({ teamId })).catch(() => undefined);
    if (error instanceof AppwriteException && error.code === 409) throw new SlugTakenError(input.slug);
    throw error;
  }
  await recordAudit(deps, caller, { action: "sector.created", sectorId: input.slug, target: `sector:${input.slug}`, detail: input.name });
  return toView({ id: input.slug, ...data }, null, null);
}
