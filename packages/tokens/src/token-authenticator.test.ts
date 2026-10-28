import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { TokenInvalidError, TokenRateLimitedError } from "./errors";
import { MemoryFailureRepository, MemorySessions, MemoryTokenRepository, MemoryUsers } from "./test-doubles";
import { TokenAuthenticator } from "./token-authenticator";
import { generateToken } from "./token-format";

let clock = new Date("2026-10-28T10:00:00Z");

async function setup() {
  const tokens = new MemoryTokenRepository(() => clock);
  const failures = new MemoryFailureRepository();
  const sessions = new MemorySessions();
  const users = new MemoryUsers({ u1: { name: "Ada", email: "ada@example.com", labels: [] } });
  const token = generateToken(randomBytes);
  const record = await tokens.insert({ userId: "u1", name: "laptop", prefix: token.prefix, tokenHash: token.hash, scope: "read", expiresAt: new Date(clock.getTime() + 86_400_000) });
  const authenticator = new TokenAuthenticator({ tokens, failures, sessions, users, now: () => clock, jwtCache: new Map() });
  return { tokens, failures, sessions, users, token, record, authenticator };
}

describe("TokenAuthenticator", () => {
  it("creates a dedicated session once and acts as the owner with the token scope", async () => {
    clock = new Date("2026-10-28T10:00:00Z");
    const { authenticator, token, sessions, tokens, record } = await setup();
    const first = await authenticator.authenticate(token.value, "203.0.113.7");
    expect(first.caller).toMatchObject({ userId: "u1", channel: "token", tokenScope: "read" });
    expect(first.jwt).toBe(`jwt-u1-s1`);
    expect(tokens.rows.get(record.id)?.sessionId).toBe("u1-s1");
    await authenticator.authenticate(token.value, "203.0.113.7");
    expect(sessions.created).toBe(1);
    expect(tokens.touches).toBe(1);
  });

  it("recreates an evicted session once", async () => {
    clock = new Date("2026-10-28T10:00:00Z");
    const { tokens, sessions, users, failures, token, record } = await setup();
    await tokens.setSession(record.id, "gone");
    const authenticator = new TokenAuthenticator({ tokens, failures, sessions, users, now: () => clock, jwtCache: new Map() });
    expect((await authenticator.authenticate(token.value, "ip")).jwt).toBe("jwt-u1-s1");
  });

  it("gives the same error for malformed, unknown, wrong, revoked, expired and ownerless tokens", async () => {
    clock = new Date("2026-10-28T10:00:00Z");
    const { authenticator, token, tokens, record, users } = await setup();
    const wrong = `${token.value.slice(0, 55)}${token.value.endsWith("A") ? "B" : "A"}`;
    const unknown = generateToken(randomBytes).value;
    for (const value of ["nonsense", unknown, wrong]) await expect(authenticator.authenticate(value, `ip-${value.length}`)).rejects.toBeInstanceOf(TokenInvalidError);
    await tokens.markRevoked(record.id, "u1", clock);
    await expect(authenticator.authenticate(token.value, "ip-r")).rejects.toBeInstanceOf(TokenInvalidError);
    tokens.rows.set(record.id, { ...record, revokedAt: null, expiresAt: clock });
    await expect(authenticator.authenticate(token.value, "ip-e")).rejects.toBeInstanceOf(TokenInvalidError);
    tokens.rows.set(record.id, { ...record, revokedAt: null });
    delete users.users.u1;
    await expect(authenticator.authenticate(token.value, "ip-o")).rejects.toBeInstanceOf(TokenInvalidError);
  });

  it("locks a client after ten failures and a prefix after five", async () => {
    clock = new Date("2026-10-28T10:00:00Z");
    const { authenticator, token } = await setup();
    for (let attempt = 0; attempt < 10; attempt += 1) await expect(authenticator.authenticate(generateToken(randomBytes).value, "198.51.100.1")).rejects.toBeInstanceOf(TokenInvalidError);
    await expect(authenticator.authenticate(token.value, "198.51.100.1")).rejects.toBeInstanceOf(TokenRateLimitedError);
    const wrong = `${token.value.slice(0, 55)}${token.value.endsWith("A") ? "B" : "A"}`;
    for (let attempt = 0; attempt < 5; attempt += 1) await expect(authenticator.authenticate(wrong, `10.0.0.${attempt}`)).rejects.toBeInstanceOf(TokenInvalidError);
    await expect(authenticator.authenticate(token.value, "10.0.0.99")).rejects.toMatchObject({ retryAfterSeconds: 900 });
    clock = new Date(clock.getTime() + 16 * 60_000);
    expect((await authenticator.authenticate(token.value, "10.0.0.99")).caller.userId).toBe("u1");
  });
});
