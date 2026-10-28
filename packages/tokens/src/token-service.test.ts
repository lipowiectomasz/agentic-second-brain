import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MemoryAuditSink } from "@cortex/audit";
import { toCaller } from "@cortex/server-kit";
import { TokenLimitReachedError, TokenNotFoundError } from "./errors";
import { MemorySessions, MemoryTokenRepository, MemoryUsers } from "./test-doubles";
import { hashToken } from "./token-format";
import { TokenService } from "./token-service";

const now = new Date("2026-10-28T10:00:00Z");
const owner = toCaller({ $id: "u1", name: "Ada", email: "ada@example.com", labels: [] }, "web");
const stranger = toCaller({ $id: "u2", name: "Max", email: "max@example.com", labels: [] }, "web");
const admin = toCaller({ $id: "u3", name: "Root", email: "root@example.com", labels: ["admin"] }, "web");

function service() {
  const tokens = new MemoryTokenRepository(() => now);
  const sessions = new MemorySessions();
  const audit = new MemoryAuditSink();
  const users = new MemoryUsers({ u1: { name: "Ada", email: "ada@example.com", labels: [] } });
  return { tokens, sessions, audit, service: new TokenService({ tokens, sessions, users, audit, now: () => now, random: randomBytes }) };
}

describe("TokenService", () => {
  it("returns the value once and stores only its hash", async () => {
    const { tokens, audit, service: tokenService } = service();
    const created = await tokenService.create(owner, { name: " laptop ", scope: "read", expiresInDays: 30 });
    const row = tokens.rows.get(created.record.id);
    expect(row?.tokenHash).toBe(hashToken(created.value));
    expect(JSON.stringify(row)).not.toContain(created.value.slice(13));
    expect(created.record).toMatchObject({ name: "laptop", scope: "read", status: "active", prefix: `cbt_${row?.prefix}`, expiresAt: "2026-11-27T10:00:00.000Z" });
    expect(JSON.stringify(audit.events)).not.toContain(created.value);
    expect(audit.events[0]).toMatchObject({ action: "token.created", actorId: "u1" });
  });

  it("rejects the eleventh active token", async () => {
    const { service: tokenService } = service();
    for (let index = 0; index < 10; index += 1) await tokenService.create(owner, { name: `t${index}`, scope: "read", expiresInDays: 7 });
    await expect(tokenService.create(owner, { name: "eleventh", scope: "read", expiresInDays: 7 })).rejects.toBeInstanceOf(TokenLimitReachedError);
  });

  it("lets the owner and an admin revoke, and hides the token from anyone else", async () => {
    const { sessions, service: tokenService, tokens } = service();
    const created = await tokenService.create(owner, { name: "laptop", scope: "write", expiresInDays: 7 });
    await tokens.setSession(created.record.id, await sessions.createSession("u1"));
    await expect(tokenService.revoke(stranger, created.record.id)).rejects.toBeInstanceOf(TokenNotFoundError);
    await expect(tokenService.revoke(stranger, "missing")).rejects.toBeInstanceOf(TokenNotFoundError);
    await tokenService.revoke(admin, created.record.id);
    expect(sessions.sessions.size).toBe(0);
    expect((await tokenService.listOwn(owner))[0]?.status).toBe("revoked");
    await tokenService.revoke(owner, created.record.id);
  });

  it("lists every token with its owner for admins only", async () => {
    const { service: tokenService } = service();
    await tokenService.create(owner, { name: "laptop", scope: "read", expiresInDays: 7 });
    expect(await tokenService.listAll(admin)).toEqual([expect.objectContaining({ name: "laptop", ownerName: "Ada" })]);
    await expect(tokenService.listAll(owner)).rejects.toThrow("Forbidden");
  });
});
