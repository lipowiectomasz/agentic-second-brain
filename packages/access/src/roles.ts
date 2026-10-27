import { Query } from "node-appwrite";
import type { SectorRole } from "@cortex/core";
import { adminLabel } from "@cortex/core";
import type { Caller } from "@cortex/server-kit";
import { ForbiddenError, isOrgAdmin, withTimeout } from "@cortex/server-kit";
import { recordAudit } from "./audit";
import { LastAdminError, UserNotFoundError } from "./errors";
import { decideRoleChange, roleFromTeamRoles } from "./rules";
import { getSectorRow } from "./sector-rows";
import type { AccessDeps, RoleChange, SectorRow } from "./types";

interface Membership {
  id: string;
  role: SectorRole;
}

async function findMembership(deps: AccessDeps, teamId: string, userId: string): Promise<Membership | null> {
  const list = await withTimeout("teams.listMemberships", () =>
    deps.admin.teams.listMemberships({ teamId, queries: [Query.equal("userId", [userId]), Query.limit(1)] }),
  );
  const membership = list.memberships[0];
  return membership === undefined ? null : { id: membership.$id, role: roleFromTeamRoles(membership.roles) };
}

export async function roleInSector(deps: AccessDeps, sector: SectorRow, userId: string): Promise<SectorRole | null> {
  if (sector.kind === "spine") return null;
  return (await findMembership(deps, sector.teamId, userId))?.role ?? null;
}

export async function getSectorRole(caller: Caller, sectorId: string, deps: AccessDeps): Promise<SectorRole | null> {
  return roleInSector(deps, await getSectorRow(deps, sectorId), caller.userId);
}

const refusalReasons = {
  spine_read_only: "spine_read_only",
  not_maintainer: "not_maintainer",
  maintainer_requires_admin: "maintainer_requires_admin",
} as const;

export async function applyRole(deps: AccessDeps, sector: SectorRow, userId: string, role: SectorRole | null): Promise<{ from: SectorRole | null; to: SectorRole | null }> {
  const existing = await findMembership(deps, sector.teamId, userId);
  const from = existing?.role ?? null;
  if (from === role) return { from, to: role };
  if (existing === null && role !== null) {
    await withTimeout("teams.createMembership", () => deps.admin.teams.createMembership({ teamId: sector.teamId, userId, roles: [role] }));
  } else if (existing !== null && role === null) {
    await withTimeout("teams.deleteMembership", () => deps.admin.teams.deleteMembership({ teamId: sector.teamId, membershipId: existing.id }));
  } else if (existing !== null && role !== null) {
    await withTimeout("teams.updateMembership", () => deps.admin.teams.updateMembership({ teamId: sector.teamId, membershipId: existing.id, roles: [role] }));
  }
  return { from, to: role };
}

export async function setRole(caller: Caller, change: RoleChange, deps: AccessDeps): Promise<void> {
  const sector = await getSectorRow(deps, change.sectorId);
  await ensureUserExists(deps, change.userId);
  const actorRole = await roleInSector(deps, sector, caller.userId);
  const targetCurrentRole = await roleInSector(deps, sector, change.userId);
  const decision = decideRoleChange({
    actor: { isOrgAdmin: isOrgAdmin(caller), actorRole },
    targetCurrentRole,
    requestedRole: change.role,
    sectorKind: sector.kind,
  });
  if (!decision.allowed) throw new ForbiddenError(refusalReasons[decision.reason]);
  const { from, to } = await applyRole(deps, sector, change.userId, change.role);
  if (from === to) return;
  await recordAudit(deps, caller, { action: "role.changed", sectorId: sector.id, target: `user:${change.userId}`, detail: `${from ?? "none"}->${to ?? "none"}` });
}

async function ensureUserExists(deps: AccessDeps, userId: string) {
  try {
    return await withTimeout("users.get", () => deps.admin.users.get({ userId }));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 404) throw new UserNotFoundError(userId);
    throw error;
  }
}

export async function setOrgAdmin(caller: Caller, input: { userId: string; isAdmin: boolean }, deps: AccessDeps): Promise<void> {
  if (!isOrgAdmin(caller)) throw new ForbiddenError("not_admin");
  const user = await ensureUserExists(deps, input.userId);
  const hasLabel = user.labels.includes(adminLabel);
  if (hasLabel === input.isAdmin) return;
  if (!input.isAdmin) {
    const admins = await withTimeout("users.list admins", () =>
      deps.admin.users.list({ queries: [Query.contains("labels", [adminLabel]), Query.limit(2)], total: true }),
    );
    if (admins.total <= 1) throw new LastAdminError();
  }
  const labels = input.isAdmin ? [...user.labels, adminLabel] : user.labels.filter((label) => label !== adminLabel);
  await withTimeout("users.updateLabels", () => deps.admin.users.updateLabels({ userId: input.userId, labels }));
  await recordAudit(deps, caller, { action: "role.changed", target: `org-admin:${input.userId}`, detail: input.isAdmin ? "none->admin" : "admin->none" });
}
