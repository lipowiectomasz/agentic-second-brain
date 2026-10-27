import { randomBytes } from "node:crypto";
import { Account, ID, Users } from "node-appwrite";
import { afterAll, describe, expect, it } from "vitest";
import { loadServerEnv } from "@cortex/config";
import { UnauthenticatedError, createAdminClient, createJwtClient, createSessionClient, resolveCaller } from "../src";

const env = loadServerEnv(process.env);
const admin = createAdminClient(env);
const users = new Users(admin);
const password = randomBytes(18).toString("base64url");
const email = `test-session-${Date.now()}@example.com`;
let userId = "";

afterAll(async () => {
  if (userId !== "") await users.delete({ userId });
});

describe("session and JWT clients", () => {
  it("resolve the same caller from an e-mail session and from a JWT", async () => {
    const user = await users.create({ userId: ID.unique(), email, password, name: "test-session" });
    userId = user.$id;
    const session = await new Account(admin).createEmailPasswordSession({ email, password });
    expect(session.secret).not.toBe("");

    const fromSession = await resolveCaller(createSessionClient(env, session.secret), "web");
    expect(fromSession).toMatchObject({ userId, email, name: "test-session", channel: "web", labels: [] });

    const jwt = await users.createJWT({ userId, sessionId: session.$id, duration: 60 });
    const fromJwt = await resolveCaller(createJwtClient(env, jwt.jwt), "token", "read");
    expect(fromJwt).toMatchObject({ userId, channel: "token", tokenScope: "read" });
  });

  it("rejects an invalid session secret as unauthenticated", async () => {
    await expect(resolveCaller(createSessionClient(env, "invalid-secret"), "web")).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});
