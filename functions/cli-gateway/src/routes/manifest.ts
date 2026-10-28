import { TablesDB } from "node-appwrite";
import { listMySectors } from "@cortex/access";
import type { ManifestData } from "@cortex/gateway-contract";
import { routes } from "@cortex/gateway-contract";
import type { ManifestEntry } from "@cortex/knowledge";
import { authorSlugOf, listManifest } from "@cortex/knowledge";
import { isOrgAdmin } from "@cortex/server-kit";
import type { GatewayContext } from "../context";
import { route } from "../router";
import { accessDeps, readDeps } from "./deps";
import { entryFromManifest } from "./file-entry";

const maxFiles = 5000;

export async function sectorsFor(ctx: GatewayContext): Promise<ManifestData["sectors"]> {
  const sectors = await listMySectors(ctx.caller, new TablesDB(ctx.userClient), accessDeps(ctx));
  return sectors.map((sector) => ({
    id: sector.id,
    slug: sector.slug,
    name: sector.name,
    kind: sector.kind,
    role: sector.myRole === "spine-reader" ? (isOrgAdmin(ctx.caller) ? "admin" : "reader") : sector.myRole === "maintainer" ? "maintainer" : "reader",
  }));
}

export async function manifest(ctx: GatewayContext): Promise<ManifestData> {
  const sectors = await sectorsFor(ctx);
  const entries: ManifestEntry[] = [];
  let cursor: string | undefined;
  do {
    const page = await listManifest(readDeps(ctx), cursor === undefined ? {} : { cursor });
    entries.push(...page.entries);
    cursor = page.nextCursor ?? undefined;
  } while (cursor !== undefined && entries.length < maxFiles);
  const visible = new Set(sectors.map((sector) => sector.id));
  return { authorSlug: authorSlugOf(ctx.caller), sectors, files: entries.filter((entry) => visible.has(entry.sectorId)).slice(0, maxFiles).map(entryFromManifest) };
}

export const manifestRoute = route(routes.manifest, manifest);
