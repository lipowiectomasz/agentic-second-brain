export const sectorRoles = ["reader", "maintainer"] as const;

export type SectorRole = (typeof sectorRoles)[number];

export const sectorKinds = ["spine", "project"] as const;

export type SectorKind = (typeof sectorKinds)[number];
