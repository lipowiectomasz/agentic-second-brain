import { randomBytes } from "node:crypto";
import { Account, ID, TablesDB, Teams, Users } from "node-appwrite";
import { MemoryAuditSink } from "@cortex/audit";
import { databaseIds, loadServerEnv } from "@cortex/config";
import type { Caller } from "@cortex/server-kit";
import { createAdminClient, createSessionClient, toCaller } from "@cortex/server-kit";
import type { AccessDeps } from "../src";

export const env = loadServerEnv(process.env);
export const admin = createAdminClient(env);
export const ids = databaseIds(env.CORTEX_TEST_DATABASE_NAMESPACE);
export const stamp = `${Date.now().toString(36)}${randomBytes(2).toString("hex")}`;

export function testDeps(): AccessDeps & { audit: MemoryAuditSink } {
  return {
    admin: { tables: new TablesDB(admin), teams: new Teams(admin), users: new Users(admin) },
    ids: { tables: ids.tables },
    audit: new MemoryAuditSink(),
    includeTestIdentities: true,
  };
}

export interface TestMember {
  caller: Caller;
  sessionTables: TablesDB;
}

export async function createMember(role: string, labels: string[] = []): Promise<TestMember> {
  const users = new Users(admin);
  const email = `test-${role}-${stamp}@example.com`;
  const password = randomBytes(18).toString("base64url");
  const user = await users.create({ userId: ID.unique(), email, password, name: `test-${role}-${stamp}` });
  if (labels.length > 0) await users.updateLabels({ userId: user.$id, labels });
  const session = await new Account(admin).createEmailPasswordSession({ email, password });
  return {
    caller: toCaller({ ...user, labels }, "web"),
    sessionTables: new TablesDB(createSessionClient(env, session.secret)),
  };
}

export async function deleteMembers(members: TestMember[]): Promise<void> {
  const users = new Users(admin);
  for (const member of members) await users.delete({ userId: member.caller.userId });
}

export async function deleteSector(slug: string): Promise<void> {
  await new TablesDB(admin).deleteRow({ databaseId: ids.tables, tableId: "sectors", rowId: slug }).catch(() => undefined);
  await new Teams(admin).delete({ teamId: `sector-${slug}` }).catch(() => undefined);
}
