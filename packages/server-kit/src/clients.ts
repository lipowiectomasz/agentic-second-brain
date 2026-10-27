import { Client } from "node-appwrite";
import type { ServerEnv } from "@cortex/config";

type ClientEnv = Pick<ServerEnv, "APPWRITE_ENDPOINT" | "APPWRITE_INTERNAL_ENDPOINT" | "APPWRITE_PROJECT_ID" | "APPWRITE_API_KEY">;

export function serverEndpoint(env: Pick<ServerEnv, "APPWRITE_ENDPOINT" | "APPWRITE_INTERNAL_ENDPOINT">): string {
  return env.APPWRITE_INTERNAL_ENDPOINT ?? env.APPWRITE_ENDPOINT;
}

export function createAdminClient(env: ClientEnv): Client {
  return new Client().setEndpoint(serverEndpoint(env)).setProject(env.APPWRITE_PROJECT_ID).setKey(env.APPWRITE_API_KEY);
}
