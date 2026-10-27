import { Permission, Role } from "node-appwrite";
import type { SectorKind } from "./sector-role";

export interface SectorAccessScope {
  kind: SectorKind;
  teamId: string;
}

export const adminLabel = "admin";

export function sectorReadPermissions(sector: SectorAccessScope): string[] {
  if (sector.kind === "spine") {
    return [Permission.read(Role.users())];
  }
  return [Permission.read(Role.team(sector.teamId))];
}

export function sectorWritePermissions(sector: SectorAccessScope): string[] {
  const adminWrites = [Permission.update(Role.label(adminLabel)), Permission.delete(Role.label(adminLabel))];
  if (sector.kind === "spine") {
    return adminWrites;
  }
  return [
    Permission.update(Role.team(sector.teamId, "maintainer")),
    Permission.delete(Role.team(sector.teamId, "maintainer")),
    ...adminWrites,
  ];
}
