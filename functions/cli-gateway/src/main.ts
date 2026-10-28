import { Client, TablesDB, Users } from "node-appwrite";
import { databaseIds } from "@cortex/config";
import { TokenAuthenticator } from "@cortex/tokens";
import { AppwriteFailureRepository, AppwriteSessionPort, AppwriteTokenRepository, AppwriteUserDirectory } from "@cortex/tokens/appwrite";
import { clientIp } from "./client-ip";
import { handleRequest } from "./handle";
import { createRouter } from "./router";
import { whoamiRoute } from "./routes/whoami";

interface AppwriteFunctionContext {
  req: { method: string; path: string; bodyText?: string; headers: Record<string, string | undefined> };
  res: { json(body: unknown, status?: number): unknown };
  error(message: string): void;
}

const lookup = createRouter([whoamiRoute]);
const jwtCache = new Map<string, { jwt: string; expiresAt: number }>();

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") throw new Error(`Missing ${name}`);
  return value;
}

export default async function main(context: AppwriteFunctionContext): Promise<unknown> {
  const endpoint = process.env.CORTEX_API_ENDPOINT ?? required("APPWRITE_FUNCTION_API_ENDPOINT");
  const project = required("APPWRITE_FUNCTION_PROJECT_ID");
  const ids = databaseIds(required("CORTEX_DATABASE_NAMESPACE"));
  const adminClient = new Client().setEndpoint(endpoint).setProject(project).setKey(context.req.headers["x-appwrite-key"] ?? "");
  const tables = new TablesDB(adminClient);
  const users = new Users(adminClient);
  const authenticator = new TokenAuthenticator({
    tokens: new AppwriteTokenRepository(tables, ids.tables),
    failures: new AppwriteFailureRepository(tables, ids.tables),
    sessions: new AppwriteSessionPort(users),
    users: new AppwriteUserDirectory(users),
    now: () => new Date(),
    jwtCache,
  });
  const response = await handleRequest(
    { method: context.req.method, path: context.req.path, bodyText: context.req.bodyText ?? "", clientIp: clientIp(context.req.headers) },
    {
      lookup,
      authenticate: (token, ip) => authenticator.authenticate(token, ip),
      context: (authenticated) => ({
        caller: authenticated.caller,
        token: { id: authenticated.record.id, scope: authenticated.record.scope, expiresAt: authenticated.record.expiresAt },
        userClient: new Client().setEndpoint(endpoint).setProject(project).setJWT(authenticated.jwt),
        adminClient,
        ids,
      }),
      forgetJwt: (authenticated) => authenticator.forgetJwt(authenticated.record.id),
      onError: (error) => context.error(error instanceof Error ? error.name : "UnknownError"),
    },
  );
  return context.res.json(response.body, response.status);
}
