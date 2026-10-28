import { rm } from "node:fs/promises";
import { Query, TablesDB, Users, VectorsDB } from "node-appwrite";
import { databaseIds, loadServerEnv } from "@cortex/config";
import { createAdminClient } from "@cortex/server-kit";
import { accountsFile, readAccounts } from "./accounts";
import { removeKnowledge } from "./knowledge-fixture";

export default async function globalTeardown(): Promise<void> {
  const env = loadServerEnv(process.env);
  const admin = createAdminClient(env);
  const accounts = await readAccounts();
  const userIds = [accounts.member, accounts.maintainer, accounts.admin].map((account) => account.userId);
  await new TablesDB(admin)
    .deleteRows({ databaseId: databaseIds(env.CORTEX_DATABASE_NAMESPACE).tables, tableId: "cli_tokens", queries: [Query.equal("userId", userIds)] })
    .catch(() => undefined);
  const tables = new TablesDB(admin);
  const ids = databaseIds(env.CORTEX_DATABASE_NAMESPACE);
  await tables.deleteRows({ databaseId: ids.tables, tableId: "proposals", queries: [Query.equal("proposerId", userIds)] }).catch(() => undefined);
  const spineFiles = await tables.listRows({ databaseId: ids.tables, tableId: "files", queries: [Query.equal("sectorId", ["spine"]), Query.startsWith("path", "standards/e2e-"), Query.select(["$id"]), Query.limit(100)] }).catch(() => ({ rows: [] }));
  for (const row of spineFiles.rows) {
    await new VectorsDB(admin).deleteDocuments({ databaseId: ids.vectors, collectionId: "chunks", queries: [Query.equal("metadata.fileId", [row.$id])] }).catch(() => undefined);
    await tables.deleteRows({ databaseId: ids.tables, tableId: "file_versions", queries: [Query.equal("fileId", [row.$id])] }).catch(() => undefined);
    await tables.deleteRow({ databaseId: ids.tables, tableId: "files", rowId: row.$id }).catch(() => undefined);
  }
  const users = new Users(admin);
  for (const userId of userIds) await users.delete({ userId });
  await removeKnowledge();
  await rm(accountsFile, { force: true });
}
