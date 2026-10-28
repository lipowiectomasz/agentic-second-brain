import "server-only";
import { TablesDB } from "node-appwrite";
import type { AuditSink } from "@cortex/audit";
import { createTablesAuditSink } from "@cortex/audit";
import { databaseIds } from "@cortex/config";
import { createAdminClient } from "@cortex/server-kit";
import { serverEnv } from "@/lib/env";

let sink: AuditSink | undefined;

export function getAuditSink(): AuditSink {
  if (sink === undefined) {
    const env = serverEnv();
    sink = createTablesAuditSink(new TablesDB(createAdminClient(env)), databaseIds(env.CORTEX_DATABASE_NAMESPACE));
  }
  return sink;
}
