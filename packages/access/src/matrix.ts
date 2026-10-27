import type { Models } from "node-appwrite";
import { AppwriteException, Query } from "node-appwrite";
import type { SectorRole } from "@cortex/core";
import { adminLabel } from "@cortex/core";
import type { Caller } from "@cortex/server-kit";
import { ForbiddenError, isOrgAdmin, withTimeout } from "@cortex/server-kit";
import { roleFromTeamRoles } from "./rules";
import { listSectorRows } from "./sector-rows";
import type { AccessDeps, AccessMatrix, MatrixRow, SectorRow } from "./types";

export const testIdentityPrefix = "test-";

export function buildMatrix(
  users: Array<Pick<Models.User<Models.Preferences>, "$id" | "name" | "email" | "labels">>,
  sectors: SectorRow[],
  memberships: Map<string, Array<{ userId: string; roles: string[] }>>,
  includeTestIdentities: boolean,
): AccessMatrix {
  const projectSectors = sectors.filter((sector) => sector.kind === "project");
  const visibleUsers = users.filter((user) => includeTestIdentities || !user.name.startsWith(testIdentityPrefix));
  const rows: MatrixRow[] = visibleUsers.map((user) => {
    const roles: Record<string, SectorRole | null> = {};
    for (const sector of projectSectors) {
      const membership = memberships.get(sector.teamId)?.find((entry) => entry.userId === user.$id);
      roles[sector.id] = membership === undefined ? null : roleFromTeamRoles(membership.roles);
    }
    return { userId: user.$id, name: user.name, email: user.email, isOrgAdmin: user.labels.includes(adminLabel), roles };
  });
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return { sectors: projectSectors.map(({ id, slug, name, color }) => ({ id, slug, name, color })), rows };
}

export async function getAccessMatrix(caller: Caller, deps: AccessDeps): Promise<AccessMatrix> {
  if (!isOrgAdmin(caller)) throw new ForbiddenError("not_admin");
  const [users, sectors] = await Promise.all([
    withTimeout("users.list", () => deps.admin.users.list({ queries: [Query.limit(100)] })),
    listSectorRows(deps.admin.tables, deps.ids.tables),
  ]);
  const memberships = new Map(
    await Promise.all(
      sectors
        .filter((sector) => sector.kind === "project")
        .map(async (sector) => {
          const list = await withTimeout("teams.listMemberships", () =>
            deps.admin.teams.listMemberships({ teamId: sector.teamId, queries: [Query.limit(100)] }),
          ).catch((error: unknown) => {
            if (error instanceof AppwriteException && error.code === 404) return { memberships: [] };
            throw error;
          });
          return [sector.teamId, list.memberships.map((membership) => ({ userId: membership.userId, roles: membership.roles }))] as const;
        }),
    ),
  );
  return buildMatrix(users.users, sectors, memberships, deps.includeTestIdentities);
}
