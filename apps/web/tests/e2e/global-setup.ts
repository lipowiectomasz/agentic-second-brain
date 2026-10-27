import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ID, Users } from "node-appwrite";
import { loadServerEnv } from "@cortex/config";
import { createAdminClient } from "@cortex/server-kit";
import type { E2eAccount, E2eAccounts } from "./accounts";
import { accountsFile } from "./accounts";
import { seedKnowledge } from "./knowledge-fixture";

async function createAccount(users: Users, role: string, labels: string[]): Promise<E2eAccount> {
  const email = `test-e2e-${role}-${Date.now()}@example.com`;
  const password = `${randomBytes(18).toString("base64url")}Aa1!`;
  const name = `e2e-${role}`;
  const user = await users.create({ userId: ID.unique(), email, password, name });
  if (labels.length > 0) await users.updateLabels({ userId: user.$id, labels });
  return { userId: user.$id, email, password, name };
}

export default async function globalSetup(): Promise<void> {
  const users = new Users(createAdminClient(loadServerEnv(process.env)));
  const accounts: E2eAccounts = {
    member: await createAccount(users, "member", []),
    maintainer: await createAccount(users, "maintainer", []),
    admin: await createAccount(users, "admin", ["admin"]),
  };
  await seedKnowledge([accounts.member.userId, accounts.admin.userId]);
  await mkdir(path.dirname(accountsFile), { recursive: true });
  await writeFile(accountsFile, JSON.stringify(accounts), { mode: 0o600 });
}
