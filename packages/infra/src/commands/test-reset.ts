import { Query, TablesDB, Teams, Users, VectorsDB } from "node-appwrite";
import { assertTestNamespace, databaseIds, loadServerEnv } from "@cortex/config";
import { createAdminClient, withTimeout } from "@cortex/server-kit";
import { findOrNull } from "../appwrite-errors";
import { runSetup } from "./setup";

export const testIdentityPrefix = "test-";

export async function runTestReset(log: (line: string) => void): Promise<number> {
  const env = loadServerEnv(process.env);
  const namespace = env.CORTEX_TEST_DATABASE_NAMESPACE;
  assertTestNamespace(namespace);
  const client = createAdminClient(env);
  const ids = databaseIds(namespace);

  await findOrNull(() => withTimeout("tablesDB.delete", () => new TablesDB(client).delete({ databaseId: ids.tables })));
  await findOrNull(() => withTimeout("vectorsDB.delete", () => new VectorsDB(client).delete({ databaseId: ids.vectors })));
  log(`deleted databases ${ids.tables}, ${ids.vectors}`);

  const users = new Users(client);
  const testUsers = await withTimeout("users.list", () => users.list({ queries: [Query.startsWith("name", testIdentityPrefix), Query.limit(100)] }));
  for (const user of testUsers.users) {
    await withTimeout("users.delete", () => users.delete({ userId: user.$id }));
  }
  const teams = new Teams(client);
  const testTeams = await withTimeout("teams.list", () => teams.list({ queries: [Query.startsWith("name", testIdentityPrefix), Query.limit(100)] }));
  for (const team of testTeams.teams) {
    await withTimeout("teams.delete", () => teams.delete({ teamId: team.$id }));
  }
  log(`deleted ${testUsers.users.length} test users and ${testTeams.teams.length} test teams`);

  return runSetup(namespace, log);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTestReset((line) => process.stdout.write(`${line}\n`))
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    });
}
