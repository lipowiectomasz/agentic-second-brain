import { rm } from "node:fs/promises";
import { Users } from "node-appwrite";
import { loadServerEnv } from "@cortex/config";
import { createAdminClient } from "@cortex/server-kit";
import { accountsFile, readAccounts } from "./accounts";

export default async function globalTeardown(): Promise<void> {
  const accounts = await readAccounts();
  const users = new Users(createAdminClient(loadServerEnv(process.env)));
  for (const account of [accounts.member, accounts.maintainer, accounts.admin]) {
    await users.delete({ userId: account.userId });
  }
  await rm(accountsFile, { force: true });
}
