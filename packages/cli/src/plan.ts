import type { FileEntry, ManifestData, ManifestSector } from "@cortex/gateway-contract";
import { localPathFor, locate } from "./layout";
import type { LocalFile } from "./local-files";
import type { SyncState } from "./state";

export type ChangeKind =
  | "unchanged"
  | "localNew"
  | "localModified"
  | "localDeleted"
  | "remoteNew"
  | "remoteModified"
  | "remoteDeleted"
  | "bothModified"
  | "immutable"
  | "readOnly"
  | "tooLarge"
  | "quarantined"
  | "unknownSector";

export interface Change {
  path: string;
  kind: ChangeKind;
  sector: ManifestSector | null;
  sectorPath: string | null;
  remote: FileEntry | null;
  baseVersion: number | null;
  baseHash: string | null;
}

function isImmutable(remote: FileEntry | null, stateKind: string | undefined, stateStatus: string | null | undefined): boolean {
  const kind = remote?.kind ?? stateKind;
  const status = remote?.meta.status ?? stateStatus ?? null;
  if (kind === "finding") return remote !== null || stateKind !== undefined;
  return (kind === "spec" || kind === "backlog") && status !== null && status !== "draft";
}

function isReadOnly(sector: ManifestSector, sectorPath: string, authorSlug: string): boolean {
  if (sector.kind === "spine") return sector.role !== "admin";
  if (sector.role === "reader") return true;
  const memory = /^memory\/([^/]+)\//.exec(sectorPath);
  return memory !== null && memory[1] !== authorSlug;
}

export function classify(local: LocalFile[], state: SyncState | null, manifest: ManifestData): Change[] {
  const remoteByPath = new Map<string, { entry: FileEntry; sector: ManifestSector }>();
  for (const entry of manifest.files) {
    const sector = manifest.sectors.find((candidate) => candidate.id === entry.sectorId);
    if (sector !== undefined) remoteByPath.set(localPathFor(sector, entry.path), { entry, sector });
  }
  const localByPath = new Map(local.map((file) => [file.path, file]));
  const quarantined = new Set((state?.quarantine ?? []).map((item) => item.path));
  const paths = new Set([...localByPath.keys(), ...remoteByPath.keys(), ...Object.keys(state?.files ?? {})]);
  const changes: Change[] = [];

  for (const path of [...paths].sort()) {
    const file = localByPath.get(path);
    const remote = remoteByPath.get(path);
    const saved = state?.files[path];
    const location = remote ?? (file === undefined ? null : locate(path, manifest.sectors));
    const sector = location?.sector ?? null;
    const sectorPath = remote?.entry.path ?? (location !== null && "path" in location ? location.path : null);
    const base = { path, sector, sectorPath, remote: remote?.entry ?? null, baseVersion: saved?.version ?? null, baseHash: saved?.hash ?? null };
    let kind: ChangeKind;

    if (file?.tooLarge === true) kind = "tooLarge";
    else if (file !== undefined && sector === null) kind = quarantined.has(path) ? "quarantined" : "unknownSector";
    else if (file !== undefined && remote !== undefined && file.bodyHash === remote.entry.hash) kind = "unchanged";
    else if (file !== undefined && saved === undefined && remote === undefined) kind = "localNew";
    else if (file !== undefined && saved === undefined && remote !== undefined) kind = "bothModified";
    else if (file !== undefined && saved !== undefined && remote !== undefined) {
      const localChanged = file.bodyHash !== saved.hash;
      const remoteChanged = remote.entry.version !== saved.version;
      kind = localChanged && remoteChanged ? "bothModified" : localChanged ? "localModified" : remoteChanged ? "remoteModified" : "unchanged";
    } else if (file === undefined && saved !== undefined && remote !== undefined) kind = remote.entry.version === saved.version ? "localDeleted" : "remoteModified";
    else if (file !== undefined && saved !== undefined && remote === undefined) kind = file.bodyHash === saved.hash ? "remoteDeleted" : "localNew";
    else if (file === undefined && remote !== undefined) kind = "remoteNew";
    else continue;

    if ((kind === "localModified" || kind === "bothModified") && isImmutable(remote?.entry ?? null, saved?.kind, saved?.meta.status)) kind = "immutable";
    if ((kind === "localModified" || kind === "bothModified" || kind === "localNew" || kind === "localDeleted") && sector !== null && sectorPath !== null && isReadOnly(sector, sectorPath, manifest.authorSlug)) kind = "readOnly";
    changes.push({ ...base, kind });
  }
  return changes;
}

export function revokedSectors(state: SyncState | null, manifest: ManifestData): string[] {
  if (state === null) return [];
  const visible = new Set(manifest.sectors.map((sector) => sector.slug));
  return Object.entries(state.sectors)
    .filter(([slug, sector]) => sector.kind === "project" && !visible.has(slug))
    .map(([slug]) => slug);
}
