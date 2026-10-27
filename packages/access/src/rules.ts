import type { SectorKind, SectorRole } from "@cortex/core";
export { deriveSlug } from "@cortex/core/slug";
import type { Caller } from "@cortex/server-kit";
import { isOrgAdmin } from "@cortex/server-kit";

export type RoleChangeRefusal = "spine_read_only" | "not_maintainer" | "maintainer_requires_admin";

export function decideRoleChange(input: {
  actor: { isOrgAdmin: boolean; actorRole: SectorRole | null };
  targetCurrentRole: SectorRole | null;
  requestedRole: SectorRole | null;
  sectorKind: SectorKind;
}): { allowed: true } | { allowed: false; reason: RoleChangeRefusal } {
  if (input.sectorKind === "spine") return { allowed: false, reason: "spine_read_only" };
  if (input.actor.isOrgAdmin) return { allowed: true };
  if (input.actor.actorRole !== "maintainer") return { allowed: false, reason: "not_maintainer" };
  if (input.requestedRole === "maintainer" || input.targetCurrentRole === "maintainer") {
    return { allowed: false, reason: "maintainer_requires_admin" };
  }
  return { allowed: true };
}

export function canWriteSector(caller: Caller, sectorKind: SectorKind, role: SectorRole | null): boolean {
  if (caller.channel === "token" && caller.tokenScope !== "write") return false;
  if (sectorKind === "spine") return isOrgAdmin(caller);
  return isOrgAdmin(caller) || role === "maintainer";
}

export function canDecideRequest(caller: Caller, actorRole: SectorRole | null, requestedRole: SectorRole): boolean {
  if (isOrgAdmin(caller)) return true;
  return actorRole === "maintainer" && requestedRole === "reader";
}

export function roleFromTeamRoles(roles: string[]): SectorRole {
  return roles.includes("maintainer") ? "maintainer" : "reader";
}
