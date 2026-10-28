import { ID, TablesDB, Teams, Users } from "node-appwrite";
import type { AccessDeps } from "@cortex/access";
import { getSectorRole } from "@cortex/access";
import { noopAuditSink } from "@cortex/audit";
import type { KnowledgeReadDeps, KnowledgeWriteDeps } from "@cortex/knowledge";
import { createAppwriteEmbedder, createQueryEmbeddingCache } from "@cortex/knowledge";
import type { GatewayContext } from "../context";

const queryCache = createQueryEmbeddingCache({ maxEntries: 200, prefixMode: "none" });

export function accessDeps(ctx: GatewayContext): AccessDeps {
  return {
    admin: { tables: new TablesDB(ctx.adminClient), teams: new Teams(ctx.adminClient), users: new Users(ctx.adminClient) },
    ids: { tables: ctx.ids.tables },
    audit: noopAuditSink,
    includeTestIdentities: false,
  };
}

export function writeDeps(ctx: GatewayContext): KnowledgeWriteDeps {
  const access = accessDeps(ctx);
  return {
    admin: ctx.adminClient,
    ids: ctx.ids,
    access: { getSectorRole: (caller, sectorId) => getSectorRole(caller, sectorId, access) },
    audit: noopAuditSink,
    embedder: createAppwriteEmbedder(ctx.adminClient),
    newId: () => ID.unique(),
    now: () => new Date(),
  };
}

export function readDeps(ctx: GatewayContext): KnowledgeReadDeps {
  return { scoped: ctx.userClient, ids: ctx.ids, embedder: createAppwriteEmbedder(ctx.adminClient), queryCache };
}
