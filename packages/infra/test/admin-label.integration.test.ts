import { randomBytes } from "node:crypto";
import { ID, Query, Users } from "node-appwrite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadServerEnv } from "@cortex/config";
import { createAdminClient } from "@cortex/server-kit";
import { LastAdminError, UserNotFoundError, grantAdmin, revokeAdmin } from "../src/commands/admin-label";

const client = createAdminClient(loadServerEnv(process.env));
const users = new Users(client);
const stamp = Date.now();
const emails = [`test-admin-a-${stamp}@example.com`, `test-admin-b-${stamp}@example.com`];
const created: string[] = [];

async function labelsOf(email: string): Promise<string[]> {
  const list = await users.list({ queries: [Query.equal("email", [email])] });
  return list.users[0]?.labels ?? [];
}

beforeAll(async () => {
  for (const email of emails) {
    const user = await users.create({ userId: ID.unique(), email, password: randomBytes(18).toString("base64url"), name: "test-admin" });
    created.push(user.$id);
  }
});

afterAll(async () => {
  for (const userId of created) await users.delete({ userId });
});

describe("admin label commands", () => {
  it("grants the admin label and keeps other labels", async () => {
    const [first] = emails as [string, string];
    const user = (await users.list({ queries: [Query.equal("email", [first])] })).users[0];
    if (user === undefined) throw new Error("missing user");
    await users.updateLabels({ userId: user.$id, labels: ["beta"] });
    await grantAdmin(client, first);
    expect(await labelsOf(first)).toEqual(["beta", "admin"]);
  });

  it("revokes the label while another admin exists", async () => {
    const [first, second] = emails as [string, string];
    await grantAdmin(client, second);
    await revokeAdmin(client, first);
    expect(await labelsOf(first)).toEqual(["beta"]);
  });

  it("refuses to remove the last admin", async () => {
    const [, second] = emails as [string, string];
    const others = await users.list({ queries: [Query.contains("labels", ["admin"])], total: true });
    if (others.total === 1) {
      await expect(revokeAdmin(client, second)).rejects.toBeInstanceOf(LastAdminError);
    } else {
      expect(others.total).toBeGreaterThan(1);
    }
  });

  it("reports an unknown e-mail", async () => {
    await expect(grantAdmin(client, `test-missing-${stamp}@example.com`)).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
