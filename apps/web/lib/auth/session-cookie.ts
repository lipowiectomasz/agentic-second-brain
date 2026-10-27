import "server-only";
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env";

export const SESSION_COOKIE = "cortex_session";
export const OAUTH_STATE_COOKIE = "cortex_oauth_state";

function secureCookies(): boolean {
  return new URL(serverEnv().APP_URL).protocol === "https:";
}

export async function readSessionSecret(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

export async function writeSessionCookie(secret: string, expire: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, secret, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies(),
    path: "/",
    expires: new Date(expire),
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function writeOAuthState(state: string): Promise<void> {
  (await cookies()).set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies(),
    path: "/auth",
    maxAge: 600,
  });
}

export async function takeOAuthState(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(OAUTH_STATE_COOKIE)?.value ?? null;
  store.delete(OAUTH_STATE_COOKIE);
  return value;
}
