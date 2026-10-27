import type { Client } from "node-appwrite";
import { Query, Users } from "node-appwrite";
import { adminLabel } from "@cortex/core";
import { loadServerEnv } from "@cortex/config";
import { createAdminClient, withTimeout } from "@cortex/server-kit";

export class UserNotFoundError extends Error {
  constructor(email: string) {
    super(`No user with e-mail ${email}`);
    this.name = "UserNotFoundError";
  }
}

export class LastAdminError extends Error {
  constructor() {
    super("Refusing to remove the admin label from the last organisation admin");
    this.name = "LastAdminError";
  }
}

async function findUser(users: Users, email: string) {
  const list = await withTimeout("users.list", () => users.list({ queries: [Query.equal("email", [email]), Query.limit(1)] }));
  const user = list.users[0];
  if (user === undefined) throw new UserNotFoundError(email);
  return user;
}

export async function grantAdmin(client: Client, email: string): Promise<void> {
  const users = new Users(client);
  const user = await findUser(users, email);
  if (user.labels.includes(adminLabel)) return;
  await withTimeout("users.updateLabels", () => users.updateLabels({ userId: user.$id, labels: [...user.labels, adminLabel] }));
}

export async function revokeAdmin(client: Client, email: string): Promise<void> {
  const users = new Users(client);
  const user = await findUser(users, email);
  if (!user.labels.includes(adminLabel)) return;
  const admins = await withTimeout("users.list", () =>
    users.list({ queries: [Query.contains("labels", [adminLabel]), Query.limit(2)], total: true }),
  );
  if (admins.total <= 1) throw new LastAdminError();
  await withTimeout("users.updateLabels", () =>
    users.updateLabels({ userId: user.$id, labels: user.labels.filter((label) => label !== adminLabel) }),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [action, flag, email] = process.argv.slice(2);
  if ((action !== "grant" && action !== "revoke") || flag !== "--email" || email === undefined || email === "") {
    process.stderr.write("usage: admin-label grant|revoke --email <email>\n");
    process.exit(2);
  }
  const client = createAdminClient(loadServerEnv(process.env));
  (action === "grant" ? grantAdmin(client, email) : revokeAdmin(client, email))
    .then(() => process.stdout.write(`${action === "grant" ? "granted" : "revoked"} admin label for ${email}\n`))
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    });
}
