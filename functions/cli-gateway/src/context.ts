import type { Client } from "node-appwrite";
import type { DatabaseIds } from "@cortex/config";
import type { TokenScope } from "@cortex/gateway-contract";
import type { Caller } from "@cortex/server-kit";

export interface GatewayContext {
  caller: Caller;
  token: { id: string; scope: TokenScope; expiresAt: Date };
  userClient: Client;
  adminClient: Client;
  ids: DatabaseIds;
}
