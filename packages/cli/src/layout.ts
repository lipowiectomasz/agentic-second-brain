import path from "node:path";
import { validateSyncPath } from "@cortex/core/sync-path";
import type { ManifestSector } from "@cortex/gateway-contract";
import { CliError, exitCodes } from "./errors";

const slugPattern = /^[a-z0-9-]{1,64}$/;

export interface LocalLocation {
  sector: ManifestSector;
  path: string;
}

export function localPathFor(sector: Pick<ManifestSector, "kind" | "slug">, filePath: string): string {
  if (!slugPattern.test(sector.slug)) throw new CliError(`The server sent an unsafe sector name: ${sector.slug}`, exitCodes.unsafePath);
  const check = validateSyncPath(filePath, sector.kind);
  if (!check.ok) throw new CliError(`The server sent an unsafe path: ${filePath} (${check.reason})`, exitCodes.unsafePath);
  return sector.kind === "spine" ? filePath : `brains/${sector.slug}/${filePath}`;
}

export function locate(localPath: string, sectors: ManifestSector[]): LocalLocation | null {
  if (localPath.startsWith("brains/")) {
    const [, slug, ...rest] = localPath.split("/");
    const sector = sectors.find((entry) => entry.kind === "project" && entry.slug === slug);
    return sector === undefined || rest.length === 0 ? null : { sector, path: rest.join("/") };
  }
  const spine = sectors.find((entry) => entry.kind === "spine");
  return spine === undefined ? null : { sector: spine, path: localPath };
}

export function safeResolve(root: string, localPath: string): string {
  const base = path.resolve(root);
  const target = path.resolve(base, ...localPath.split("/"));
  if (!target.startsWith(`${base}${path.sep}`)) throw new CliError(`Refusing to write outside the sync root: ${localPath}`, exitCodes.unsafePath);
  return target;
}
