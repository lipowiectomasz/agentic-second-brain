import "server-only";
import { ID, TablesDB, Teams, Users } from "node-appwrite";
import { getSectorRole } from "@cortex/access";
import { noopAuditSink } from "@cortex/audit";
import { databaseIds } from "@cortex/config";
import { createAppwriteEmbedder, defaultEmbedderOptions } from "@cortex/knowledge";
import type { ProposalDeps } from "@cortex/proposals";
import { pendingCount } from "@cortex/proposals";
import type { Caller } from "@cortex/server-kit";
import { createAdminClient } from "@cortex/server-kit";
import { getSessionClient } from "@/lib/auth/session-client";
import { serverEnv } from "@/lib/env";

export function proposalDeps(): ProposalDeps {
  const env = serverEnv();
  const admin = createAdminClient(env);
  const ids = databaseIds(env.CORTEX_DATABASE_NAMESPACE);
  const tables = new TablesDB(admin);
  const access = { admin: { tables, teams: new Teams(admin), users: new Users(admin) }, ids: { tables: ids.tables }, audit: noopAuditSink, includeTestIdentities: env.CORTEX_DATABASE_NAMESPACE.endsWith("_test") };
  return {
    tables,
    databaseId: ids.tables,
    audit: noopAuditSink,
    knowledge: {
      admin,
      ids,
      access: { getSectorRole: (caller, sectorId) => getSectorRole(caller, sectorId, access) },
      audit: noopAuditSink,
      embedder: createAppwriteEmbedder(admin, { ...defaultEmbedderOptions, prefixMode: env.CORTEX_EMBEDDING_PREFIX_MODE }),
      newId: () => ID.unique(),
      now: () => new Date(),
    },
    maxPending: env.CORTEX_MAX_PENDING_PROPOSALS,
    now: () => new Date(),
  };
}

export async function sessionTables(): Promise<{ tables: TablesDB; databaseId: string }> {
  return { tables: new TablesDB(await getSessionClient()), databaseId: databaseIds(serverEnv().CORTEX_DATABASE_NAMESPACE).tables };
}

export async function pendingForAdmin(caller: Caller): Promise<number> {
  const { tables, databaseId } = await sessionTables();
  return pendingCount(caller, tables, databaseId).catch(() => 0);
}
