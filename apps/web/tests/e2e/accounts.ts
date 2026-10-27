import { readFile } from "node:fs/promises";
import path from "node:path";

export interface E2eAccount {
  userId: string;
  email: string;
  password: string;
  name: string;
}

export interface E2eAccounts {
  member: E2eAccount;
  admin: E2eAccount;
}

export const accountsFile = path.resolve(import.meta.dirname, "../../../../.playwright/accounts.json");

export async function readAccounts(): Promise<E2eAccounts> {
  return JSON.parse(await readFile(accountsFile, "utf8")) as E2eAccounts;
}
