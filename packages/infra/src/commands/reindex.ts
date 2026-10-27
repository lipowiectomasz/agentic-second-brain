import type { Models } from "node-appwrite";
import { ID, Query, TablesDB } from "node-appwrite";
import { noopAuditSink } from "@cortex/audit";
import { databaseIds, loadServerEnv } from "@cortex/config";
import type { FileRow } from "@cortex/knowledge";
import { createAppwriteEmbedder, defaultEmbedderOptions, filesTableId, reindexFile, toFileRowFromRaw } from "@cortex/knowledge";
import { createAdminClient, withTimeout } from "@cortex/server-kit";

export async function runReindex(namespace: string, log: (line: string) => void): Promise<number> {
  const env = loadServerEnv(process.env);
  const admin = createAdminClient(env);
  const ids = databaseIds(namespace);
  const deps = {
    admin,
    ids,
    access: { getSectorRole: async () => null },
    audit: noopAuditSink,
    embedder: createAppwriteEmbedder(admin, { ...defaultEmbedderOptions, prefixMode: env.CORTEX_EMBEDDING_PREFIX_MODE }),
    newId: () => ID.unique(),
    now: () => new Date(),
  };
  const tables = new TablesDB(admin);
  let cursor: string | null = null;
  let files = 0;
  let chunks = 0;
  for (;;) {
    const queries = [Query.orderAsc("$id"), Query.limit(50)];
    if (cursor !== null) queries.push(Query.cursorAfter(cursor));
    const page = await withTimeout("tablesDB.listRows files", () => tables.listRows<Models.Row & Record<string, unknown>>({ databaseId: ids.tables, tableId: filesTableId, queries }));
    for (const raw of page.rows) {
      const row: FileRow = toFileRowFromRaw(raw);
      chunks += await reindexFile(deps, row);
      files += 1;
    }
    const last = page.rows[page.rows.length - 1];
    if (last === undefined || page.rows.length < 50) break;
    cursor = last.$id;
  }
  log(`Reindexed ${files} files into ${chunks} chunks (prefix mode ${env.CORTEX_EMBEDDING_PREFIX_MODE})`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const env = loadServerEnv(process.env);
  runReindex(env.CORTEX_DATABASE_NAMESPACE, (line) => process.stdout.write(`${line}\n`))
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    });
}
