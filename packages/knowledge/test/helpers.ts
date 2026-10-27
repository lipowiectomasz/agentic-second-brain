import { randomBytes } from "node:crypto";
import { Account, ID, Permission, Role, TablesDB, Teams, Users, VectorsDB } from "node-appwrite";
import { getSectorRole } from "@cortex/access";
import { MemoryAuditSink } from "@cortex/audit";
import { databaseIds, loadServerEnv } from "@cortex/config";
import type { Caller } from "@cortex/server-kit";
import { createAdminClient, createSessionClient, toCaller } from "@cortex/server-kit";
import type { KnowledgeWriteDeps } from "../src";
import { createAppwriteEmbedder } from "../src";

export const env = loadServerEnv(process.env);
export const admin = createAdminClient(env);
export const ids = databaseIds(env.CORTEX_TEST_DATABASE_NAMESPACE);
export const stamp = `${Date.now().toString(36)}${randomBytes(2).toString("hex")}`;
export const sectorId = `test-k-${stamp}`;
export const teamId = `sector-${sectorId}`;

export interface Member {
  caller: Caller;
  vectors: VectorsDB;
  tables: TablesDB;
}

const created: string[] = [];
const accessDeps = {
  admin: { tables: new TablesDB(admin), teams: new Teams(admin), users: new Users(admin) },
  ids: { tables: ids.tables },
  audit: new MemoryAuditSink(),
  includeTestIdentities: true,
};

export const audit = new MemoryAuditSink();

export function writeDeps(): KnowledgeWriteDeps {
  return {
    admin,
    ids,
    access: { getSectorRole: (caller, id) => getSectorRole(caller, id, accessDeps) },
    audit,
    embedder: createAppwriteEmbedder(admin),
    newId: () => ID.unique(),
    now: () => new Date(),
  };
}

export async function createMember(role: string, options: { teamRole?: "reader" | "maintainer"; admin?: boolean; local?: string } = {}): Promise<Member> {
  const users = new Users(admin);
  const email = `${options.local ?? `test-${role}-${stamp}`}@example.com`;
  const password = randomBytes(18).toString("base64url");
  const user = await users.create({ userId: ID.unique(), email, password, name: `test-${role}-${stamp}` });
  created.push(user.$id);
  const labels = options.admin === true ? ["admin"] : [];
  if (labels.length > 0) await users.updateLabels({ userId: user.$id, labels });
  if (options.teamRole !== undefined) await new Teams(admin).createMembership({ teamId, userId: user.$id, roles: [options.teamRole] });
  const session = await new Account(admin).createEmailPasswordSession({ email, password });
  const client = createSessionClient(env, session.secret);
  return { caller: toCaller({ ...user, labels }, "web"), vectors: new VectorsDB(client), tables: new TablesDB(client) };
}

export async function createProjectSector(): Promise<void> {
  await new Teams(admin).create({ teamId, name: `test-k-${stamp}`, roles: ["maintainer", "reader"] });
  await new TablesDB(admin).createRow({
    databaseId: ids.tables,
    tableId: "sectors",
    rowId: sectorId,
    data: { slug: sectorId, name: `test-k-${stamp}`, kind: "project", teamId, color: "#1d6f70" },
    permissions: [Permission.read(Role.users())],
  });
}

export async function cleanup(): Promise<void> {
  const users = new Users(admin);
  for (const userId of created) await users.delete({ userId }).catch(() => undefined);
  await new TablesDB(admin).deleteRow({ databaseId: ids.tables, tableId: "sectors", rowId: sectorId }).catch(() => undefined);
  await new Teams(admin).delete({ teamId }).catch(() => undefined);
}
