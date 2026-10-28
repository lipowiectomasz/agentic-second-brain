import { randomBytes } from "node:crypto";
import { ID, Permission, Role, TablesDB, Teams, Users } from "node-appwrite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MemoryAuditSink } from "@cortex/audit";
import { databaseIds, gatewayFunctionId, loadServerEnv } from "@cortex/config";
import { callGateway, routes } from "@cortex/gateway-contract";
import { createAdminClient, serverEndpoint, toCaller } from "@cortex/server-kit";
import { TokenService } from "../src";
import { AppwriteSessionPort, AppwriteTokenRepository, AppwriteUserDirectory } from "../src/appwrite";

const env = loadServerEnv(process.env);
const namespace = env.CORTEX_TEST_DATABASE_NAMESPACE;
const admin = createAdminClient(env);
const ids = databaseIds(namespace);
const tables = new TablesDB(admin);
const users = new Users(admin);
const stamp = `${Date.now().toString(36)}${randomBytes(2).toString("hex")}`;
const sectorId = `test-g-${stamp}`;
const teamId = `sector-${sectorId}`;
const audit = new MemoryAuditSink();
const tokens = new AppwriteTokenRepository(tables, ids.tables);
const service = new TokenService({ tokens, sessions: new AppwriteSessionPort(users), users: new AppwriteUserDirectory(users), audit, now: () => new Date(), random: randomBytes });
const createdUsers: string[] = [];
let owner: ReturnType<typeof toCaller>;

function target(ip: string) {
  return { endpoint: serverEndpoint(env), projectId: env.APPWRITE_PROJECT_ID, functionId: gatewayFunctionId(namespace), headers: { "x-forwarded-for": ip } };
}

const whoami = (auth: string, ip = `198.51.100.${Math.floor(Math.random() * 200) + 1}`) => callGateway(target(ip), routes.whoami, auth, {});

beforeAll(async () => {
  const user = await users.create({ userId: ID.unique(), email: `test-gw-${stamp}@example.com`, password: randomBytes(18).toString("base64url"), name: `test-gw-${stamp}` });
  createdUsers.push(user.$id);
  owner = toCaller(user, "web");
  await new Teams(admin).create({ teamId, name: `test-gw-${stamp}`, roles: ["maintainer", "reader"] });
  await tables.createRow({ databaseId: ids.tables, tableId: "sectors", rowId: sectorId, data: { slug: sectorId, name: "Gateway sector", kind: "project", teamId, color: "#1b6a6b" }, permissions: [Permission.read(Role.users())] });
  await new Teams(admin).createMembership({ teamId, userId: user.$id, roles: ["maintainer"] });
});

afterAll(async () => {
  for (const userId of createdUsers) await users.delete({ userId }).catch(() => undefined);
  await tables.deleteRow({ databaseId: ids.tables, tableId: "sectors", rowId: sectorId }).catch(() => undefined);
  await new Teams(admin).delete({ teamId }).catch(() => undefined);
});

describe("cli gateway", () => {
  it("answers whoami as the token owner and follows membership changes", async () => {
    const { value, record } = await service.create(owner, { name: "laptop", scope: "read", expiresInDays: 7 });
    const first = await whoami(value);
    expect(first).toMatchObject({ status: 200, ok: true, data: { userId: owner.userId, scope: "read", expiresAt: record.expiresAt } });
    if (!first.ok) throw new Error("expected success");
    expect(first.data.sectors.find((sector) => sector.id === sectorId)).toMatchObject({ role: "maintainer" });
    expect(first.data.sectors.some((sector) => sector.kind === "spine")).toBe(true);
    const row = await tokens.findById(record.id);
    expect(row?.sessionId).not.toBeNull();
    expect(row?.lastUsedAt).not.toBeNull();

    const memberships = await new Teams(admin).listMemberships({ teamId });
    for (const membership of memberships.memberships) await new Teams(admin).deleteMembership({ teamId, membershipId: membership.$id });
    const second = await whoami(value);
    if (!second.ok) throw new Error("expected success");
    expect(second.data.sectors.some((sector) => sector.id === sectorId)).toBe(false);
  });

  it("keeps working after its session is evicted", async () => {
    const { value, record } = await service.create(owner, { name: "evicted", scope: "write", expiresInDays: 7 });
    expect((await whoami(value)).ok).toBe(true);
    const sessionId = (await tokens.findById(record.id))?.sessionId ?? "";
    await users.deleteSession({ userId: owner.userId, sessionId });
    expect(await whoami(value)).toMatchObject({ status: 200, ok: true });
  });

  it("refuses revoked and expired tokens with the same answer and drops the session", async () => {
    const revoked = await service.create(owner, { name: "revoked", scope: "read", expiresInDays: 7 });
    expect((await whoami(revoked.value)).ok).toBe(true);
    const sessionId = (await tokens.findById(revoked.record.id))?.sessionId ?? "";
    await service.revoke(owner, revoked.record.id);
    const afterRevoke = await whoami(revoked.value);
    expect(afterRevoke).toEqual({ status: 401, ok: false, error: { code: "token_invalid", message: "The token is invalid, expired or revoked." } });
    const sessions = await users.listSessions({ userId: owner.userId });
    expect(sessions.sessions.some((session) => session.$id === sessionId)).toBe(false);
    expect(JSON.stringify(audit.events)).not.toContain(revoked.value);

    const expired = await service.create(owner, { name: "expired", scope: "read", expiresInDays: 7 });
    await tables.updateRow({ databaseId: ids.tables, tableId: "cli_tokens", rowId: expired.record.id, data: { expiresAt: new Date(Date.now() - 1000).toISOString() } });
    expect(await whoami(expired.value)).toEqual(afterRevoke);
  });

  it("locks a client after ten failed attempts", async () => {
    const ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
    const { value } = await service.create(owner, { name: "locked", scope: "read", expiresInDays: 7 });
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const prefix = Array.from(randomBytes(8), (byte) => "abcdefghijklmnopqrstuvwxyz234567"[byte % 32]).join("");
      const wrong = `cbt_${prefix}_${randomBytes(32).toString("base64url")}`;
      expect((await whoami(wrong, ip)).status).toBe(401);
    }
    const locked = await whoami(value, ip);
    expect(locked).toMatchObject({ status: 429, ok: false, error: { code: "rate_limited" } });
    if (locked.ok) throw new Error("expected lock");
    expect(Number(locked.error.details?.retryAfter)).toBeGreaterThan(0);
  });
});
