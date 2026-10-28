import { randomBytes } from "node:crypto";
import { Account, AppwriteException, ID, TablesDB, Users } from "node-appwrite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { databaseIds, loadServerEnv } from "@cortex/config";
import { createAdminClient, createSessionClient } from "@cortex/server-kit";
import { auditEventsTableId, createTablesAuditSink, listAuditEvents } from "../src";

const env = loadServerEnv(process.env);
const admin = createAdminClient(env);
const ids = databaseIds(env.CORTEX_TEST_DATABASE_NAMESPACE);
const users = new Users(admin);
const stamp = `${Date.now().toString(36)}${randomBytes(2).toString("hex")}`;
const created: string[] = [];
const sessions: Record<"boss" | "member", TablesDB> = {} as never;

async function session(name: "boss" | "member", labels: string[]): Promise<TablesDB> {
  const email = `test-audit-${name}-${stamp}@example.com`;
  const password = randomBytes(18).toString("base64url");
  const user = await users.create({ userId: ID.unique(), email, password, name: `test-${name}-${stamp}` });
  created.push(user.$id);
  if (labels.length > 0) await users.updateLabels({ userId: user.$id, labels });
  const login = await new Account(admin).createEmailPasswordSession({ email, password });
  return new TablesDB(createSessionClient(env, login.secret));
}

beforeAll(async () => {
  sessions.boss = await session("boss", ["admin"]);
  sessions.member = await session("member", []);
});

afterAll(async () => {
  for (const userId of created) await users.delete({ userId }).catch(() => undefined);
});

describe("audit log", () => {
  it("is readable by admins only and cannot be changed by members", async () => {
    const sink = createTablesAuditSink(new TablesDB(admin), ids);
    const target = `sector:test-audit-${stamp}`;
    await sink.record({ actorId: "u-audit", actorName: "Audit tester", channel: "web", action: "sector.created", sectorId: `test-audit-${stamp}`, target });
    await sink.record({ actorId: "u-audit", actorName: "Audit tester", channel: "token", action: "token.created", target: "cbt_abcdefgh", detail: "read, 7 days" });

    const forAdmin = await listAuditEvents(sessions.boss, ids, { actorId: "u-audit" });
    expect(forAdmin.events.map((event) => event.action)).toEqual(["token.created", "sector.created"]);
    const filtered = await listAuditEvents(sessions.boss, ids, { actorId: "u-audit", action: "sector.created" });
    expect(filtered.events).toHaveLength(1);
    expect(filtered.events[0]).toMatchObject({ target, channel: "web", sectorId: `test-audit-${stamp}` });

    expect((await listAuditEvents(sessions.member, ids, { actorId: "u-audit" })).events).toEqual([]);
    const rowId = forAdmin.events[0]?.id ?? "";
    for (const attempt of [
      () => sessions.member.updateRow({ databaseId: ids.tables, tableId: auditEventsTableId, rowId, data: { detail: "forged" } }),
      () => sessions.member.deleteRow({ databaseId: ids.tables, tableId: auditEventsTableId, rowId }),
      () => sessions.boss.updateRow({ databaseId: ids.tables, tableId: auditEventsTableId, rowId, data: { detail: "forged" } }),
      () => sessions.boss.deleteRow({ databaseId: ids.tables, tableId: auditEventsTableId, rowId }),
    ]) {
      await expect(attempt()).rejects.toBeInstanceOf(AppwriteException);
    }
    expect((await listAuditEvents(sessions.boss, ids, { actorId: "u-audit" })).events[0]?.detail).toBe("read, 7 days");
  });
});
