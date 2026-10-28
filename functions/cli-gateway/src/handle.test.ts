import { describe, expect, it } from "vitest";
import { AppwriteException } from "node-appwrite";
import { z } from "zod";
import { toCaller } from "@cortex/server-kit";
import type { AuthenticatedToken } from "@cortex/tokens";
import { TokenInvalidError, TokenRateLimitedError } from "@cortex/tokens";
import { clientIp } from "./client-ip";
import type { GatewayServices } from "./handle";
import { handleRequest, maxBodyBytes } from "./handle";
import { createRouter, route } from "./router";

const token = `cbt_abcdefgh_${"A".repeat(43)}`;

function authenticated(scope: "read" | "write"): AuthenticatedToken {
  const caller = toCaller({ $id: "u1", name: "Ada", email: "ada@example.com", labels: [] }, "token", scope);
  return { caller, jwt: "jwt", record: { id: "t1", userId: "u1", name: "laptop", prefix: "abcdefgh", tokenHash: "h", scope, createdAt: new Date(), expiresAt: new Date(), lastUsedAt: null, revokedAt: null, sessionId: "s1" } };
}

function services(scope: "read" | "write", authenticate?: GatewayServices["authenticate"]): GatewayServices {
  return {
    lookup: createRouter([
      route({ path: "/v1/echo", access: "read", input: z.object({ text: z.string() }) }, async (_ctx, input) => ({ echoed: input.text })),
      route({ path: "/v1/write", access: "write", input: z.object({}) }, async () => ({ written: true })),
    ]),
    authenticate: authenticate ?? (async () => authenticated(scope)),
    context: (auth) => ({ caller: auth.caller, token: { id: auth.record.id, scope: auth.record.scope, expiresAt: auth.record.expiresAt }, userClient: {} as never, adminClient: {} as never, ids: { vectors: "v", tables: "t" } }),
  };
}

const call = (path: string, body: unknown, svc: GatewayServices, method = "POST") => handleRequest({ method, path, bodyText: typeof body === "string" ? body : JSON.stringify(body), clientIp: "203.0.113.7" }, svc);

describe("gateway request handling", () => {
  it("runs a read route and wraps the result", async () => {
    expect(await call("/v1/echo", { auth: token, input: { text: "hi" } }, services("read"))).toEqual({ status: 200, body: { ok: true, data: { echoed: "hi" } } });
  });

  it("rejects a read token on a write route", async () => {
    const response = await call("/v1/write", { auth: token, input: {} }, services("read"));
    expect(response).toMatchObject({ status: 403, body: { ok: false, error: { code: "token_scope" } } });
    expect((await call("/v1/write", { auth: token, input: {} }, services("write"))).status).toBe(200);
  });

  it("answers unknown routes, wrong methods, bad JSON, bad envelopes and oversize bodies without echoing the token", async () => {
    const svc = services("read");
    const responses = [
      await call("/v1/missing", { auth: token, input: {} }, svc),
      await call("/v1/echo", { auth: token, input: {} }, svc, "GET"),
      await call("/v1/echo", "{not json", svc),
      await call("/v1/echo", { auth: "cbt_short", input: {} }, svc),
      await call("/v1/echo", { auth: token, input: { text: 1 } }, svc),
      await call("/v1/echo", "x".repeat(maxBodyBytes + 1), svc),
    ];
    expect(responses.map((response) => response.status)).toEqual([404, 400, 400, 400, 400, 413]);
    expect(JSON.stringify(responses)).not.toContain("AAAAAAAA");
    expect(JSON.stringify(responses)).not.toContain("cbt_short");
  });

  it("maps authentication failures to a uniform 401 and to 429 with retryAfter", async () => {
    const invalid = await call("/v1/echo", { auth: token, input: { text: "x" } }, services("read", async () => Promise.reject(new TokenInvalidError())));
    expect(invalid).toEqual({ status: 401, body: { ok: false, error: { code: "token_invalid", message: "The token is invalid, expired or revoked." } } });
    const limited = await call("/v1/echo", { auth: token, input: { text: "x" } }, services("read", async () => Promise.reject(new TokenRateLimitedError(120))));
    expect(limited).toMatchObject({ status: 429, body: { error: { code: "rate_limited", details: { retryAfter: 120 } } } });
  });

  it("re-authenticates once when Appwrite rejects a cached JWT", async () => {
    let calls = 0;
    let forgotten = 0;
    const svc = services("read");
    const response = await handleRequest(
      { method: "POST", path: "/v1/stale", bodyText: JSON.stringify({ auth: token, input: {} }), clientIp: "203.0.113.7" },
      {
        ...svc,
        lookup: createRouter([
          route({ path: "/v1/stale", access: "read", input: z.object({}) }, async () => {
            calls += 1;
            if (calls === 1) throw new AppwriteException("expired", 401);
            return { calls };
          }),
        ]),
        forgetJwt: () => {
          forgotten += 1;
        },
      },
    );
    expect(response).toEqual({ status: 200, body: { ok: true, data: { calls: 2 } } });
    expect(forgotten).toBe(1);
  });

  it("hides internal error messages", async () => {
    const response = await call("/v1/echo", { auth: token, input: { text: "x" } }, services("read", async () => Promise.reject(new Error("db password is hunter2"))));
    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain("hunter2");
  });
});

describe("clientIp", () => {
  it("prefers the Appwrite client address and rejects anything that is not an address", () => {
    expect(clientIp({ "x-appwrite-client-ip": "203.0.113.7" })).toBe("203.0.113.7");
    expect(clientIp({ "x-forwarded-for": "198.51.100.2, 10.0.0.1" })).toBe("198.51.100.2");
    expect(clientIp({ "x-appwrite-client-ip": "<script>" })).toBe("unknown");
    expect(clientIp({})).toBe("unknown");
  });
});
