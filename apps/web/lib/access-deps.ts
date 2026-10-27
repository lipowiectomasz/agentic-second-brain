import "server-only";
import { TablesDB, Teams, Users } from "node-appwrite";
import type { AccessDeps } from "@cortex/access";
import { noopAuditSink } from "@cortex/audit";
import { databaseIds } from "@cortex/config";
import { createAdminClient } from "@cortex/server-kit";
import { serverEnv } from "@/lib/env";

export function getAccessDeps(): AccessDeps {
  const env = serverEnv();
  const admin = createAdminClient(env);
  return {
    admin: { tables: new TablesDB(admin), teams: new Teams(admin), users: new Users(admin) },
    ids: { tables: databaseIds(env.CORTEX_DATABASE_NAMESPACE).tables },
    audit: noopAuditSink,
    includeTestIdentities: env.CORTEX_DATABASE_NAMESPACE.endsWith("_test"),
  };
}
