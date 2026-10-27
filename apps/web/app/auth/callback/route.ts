import { timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { Account } from "node-appwrite";
import { createAdminClient, withTimeout } from "@cortex/server-kit";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { takeOAuthState, writeSessionCookie } from "@/lib/auth/session-cookie";
import { serverEnv } from "@/lib/env";

function sameState(expected: string | null, received: string | null): boolean {
  if (expected === null || received === null) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest): Promise<never> {
  const params = request.nextUrl.searchParams;
  const expected = await takeOAuthState();
  const userId = params.get("userId");
  const secret = params.get("secret");
  let ok = false;
  if (sameState(expected, params.get("state")) && userId !== null && secret !== null) {
    try {
      const session = await withTimeout("account.createSession", () =>
        new Account(createAdminClient(serverEnv())).createSession({ userId, secret }),
      );
      await writeSessionCookie(session.secret, session.expire);
      ok = true;
    } catch (error) {
      console.error("oauth callback failed", error instanceof Error ? error.name : "unknown");
    }
  }
  redirect(ok ? safeNextPath(params.get("next")) : "/login?error=oauth");
}
