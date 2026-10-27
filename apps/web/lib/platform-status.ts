import "server-only";
import { connection } from "next/server";
import { TablesDB } from "node-appwrite";
import { loadServerEnv } from "@cortex/config";
import { createAdminClient, serverEndpoint, withTimeout } from "@cortex/server-kit";

export type PlatformStatus =
  | { ok: true; version: string; project: string }
  | { ok: false; failedCheck: "configuration" | "health" | "project"; message: string };

export async function getPlatformStatus(): Promise<PlatformStatus> {
  await connection();
  let env;
  try {
    env = loadServerEnv(process.env);
  } catch (error) {
    return { ok: false, failedCheck: "configuration", message: error instanceof Error ? error.message : "Invalid configuration" };
  }

  let version: string;
  try {
    const response = await withTimeout("health version", () =>
      fetch(`${serverEndpoint(env)}/health/version`, { cache: "no-store", signal: AbortSignal.timeout(5_000) }),
    );
    version = ((await response.json()) as { version: string }).version;
  } catch {
    return { ok: false, failedCheck: "health", message: "Appwrite is not reachable." };
  }

  try {
    await withTimeout("tablesDB.list", () => new TablesDB(createAdminClient(env)).list({}), 5_000);
  } catch {
    return { ok: false, failedCheck: "project", message: `Project ${env.APPWRITE_PROJECT_ID} rejected the server key.` };
  }

  return { ok: true, version, project: env.APPWRITE_PROJECT_ID };
}
