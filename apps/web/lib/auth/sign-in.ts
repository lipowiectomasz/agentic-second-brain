import "server-only";
import { headers } from "next/headers";
import { Account } from "node-appwrite";
import { RateLimitedError, createAdminClient, mapAppwriteAuthError, withTimeout } from "@cortex/server-kit";
import { serverEnv } from "@/lib/env";
import { writeSessionCookie } from "./session-cookie";

export const invalidCredentialsMessage = "Invalid email or password.";
export const rateLimitedMessage = "Too many attempts. Try again in a minute.";

export async function adminClientForRequest() {
  const userAgent = (await headers()).get("user-agent");
  return createAdminClient(serverEnv(), userAgent === null ? {} : { forwardedUserAgent: userAgent });
}

export async function signInWithPassword(email: string, password: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const account = new Account(await adminClientForRequest());
    const session = await withTimeout("account.createEmailPasswordSession", () => account.createEmailPasswordSession({ email, password }), 10_000);
    await writeSessionCookie(session.secret, session.expire);
    return { ok: true };
  } catch (error) {
    const mapped = mapAppwriteAuthError(error);
    if (mapped instanceof RateLimitedError) return { ok: false, message: rateLimitedMessage };
    console.error("sign-in failed", mapped.name);
    return { ok: false, message: invalidCredentialsMessage };
  }
}
