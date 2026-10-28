import "server-only";
import { randomBytes } from "node:crypto";
import { TablesDB, Users } from "node-appwrite";
import { noopAuditSink } from "@cortex/audit";
import { databaseIds } from "@cortex/config";
import { createAdminClient } from "@cortex/server-kit";
import { TokenService } from "@cortex/tokens";
import { AppwriteSessionPort, AppwriteTokenRepository, AppwriteUserDirectory } from "@cortex/tokens/appwrite";
import { serverEnv } from "@/lib/env";

export function getTokenService(): TokenService {
  const env = serverEnv();
  const admin = createAdminClient(env);
  const users = new Users(admin);
  return new TokenService({
    tokens: new AppwriteTokenRepository(new TablesDB(admin), databaseIds(env.CORTEX_DATABASE_NAMESPACE).tables),
    sessions: new AppwriteSessionPort(users),
    users: new AppwriteUserDirectory(users),
    audit: noopAuditSink,
    now: () => new Date(),
    random: randomBytes,
  });
}
