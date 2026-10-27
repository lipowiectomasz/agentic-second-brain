import { Client } from "node-appwrite";
import type { ServerEnv } from "@cortex/config";

type EndpointEnv = Pick<ServerEnv, "APPWRITE_ENDPOINT" | "APPWRITE_INTERNAL_ENDPOINT">;
type ProjectEnv = EndpointEnv & Pick<ServerEnv, "APPWRITE_PROJECT_ID">;
type AdminEnv = ProjectEnv & Pick<ServerEnv, "APPWRITE_API_KEY">;

export interface AdminClientOptions {
  forwardedUserAgent?: string;
}

export function serverEndpoint(env: EndpointEnv): string {
  return env.APPWRITE_INTERNAL_ENDPOINT ?? env.APPWRITE_ENDPOINT;
}

function projectClient(env: ProjectEnv): Client {
  return new Client().setEndpoint(serverEndpoint(env)).setProject(env.APPWRITE_PROJECT_ID);
}

export function createAdminClient(env: AdminEnv, options: AdminClientOptions = {}): Client {
  const client = projectClient(env).setKey(env.APPWRITE_API_KEY);
  if (options.forwardedUserAgent !== undefined) {
    client.setForwardedUserAgent(options.forwardedUserAgent);
  }
  return client;
}

export function createSessionClient(env: ProjectEnv, sessionSecret: string): Client {
  return projectClient(env).setSession(sessionSecret);
}

export function createJwtClient(env: ProjectEnv, jwt: string): Client {
  return projectClient(env).setJWT(jwt);
}
