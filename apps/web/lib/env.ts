import "server-only";
import type { ServerEnv } from "@cortex/config";
import { loadServerEnv } from "@cortex/config";

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= loadServerEnv(process.env);
  return cached;
}

export function githubOAuthEnabled(env: ServerEnv): boolean {
  return env.GITHUB_OAUTH_CLIENT_ID !== undefined && env.GITHUB_OAUTH_CLIENT_SECRET !== undefined;
}
