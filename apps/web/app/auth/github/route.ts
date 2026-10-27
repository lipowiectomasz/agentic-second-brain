import { randomBytes } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { connection } from "next/server";
import { Account, OAuthProvider } from "node-appwrite";
import { createAdminClient, withTimeout } from "@cortex/server-kit";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { writeOAuthState } from "@/lib/auth/session-cookie";
import { githubOAuthEnabled, serverEnv } from "@/lib/env";

export async function GET(request: NextRequest): Promise<never> {
  await connection();
  const env = serverEnv();
  if (!githubOAuthEnabled(env)) notFound();
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const state = randomBytes(32).toString("base64url");
  await writeOAuthState(state);
  const url = await withTimeout("account.createOAuth2Token", () =>
    new Account(createAdminClient(env)).createOAuth2Token({
      provider: OAuthProvider.Github,
      success: `${env.APP_URL}/auth/callback?next=${encodeURIComponent(next)}&state=${state}`,
      failure: `${env.APP_URL}/login?error=oauth`,
      scopes: ["read:user", "user:email"],
    }),
  );
  redirect(url);
}
