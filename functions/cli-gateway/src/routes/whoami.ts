import { TablesDB, Teams, Users } from "node-appwrite";
import { listMySectors } from "@cortex/access";
import { noopAuditSink } from "@cortex/audit";
import type { WhoamiData } from "@cortex/gateway-contract";
import { routes } from "@cortex/gateway-contract";
import { isOrgAdmin } from "@cortex/server-kit";
import type { GatewayContext } from "../context";
import { route } from "../router";

export async function whoami(ctx: GatewayContext): Promise<WhoamiData> {
  const sectors = await listMySectors(ctx.caller, new TablesDB(ctx.userClient), {
    admin: { tables: new TablesDB(ctx.adminClient), teams: new Teams(ctx.adminClient), users: new Users(ctx.adminClient) },
    ids: { tables: ctx.ids.tables },
    audit: noopAuditSink,
    includeTestIdentities: false,
  });
  return {
    userId: ctx.caller.userId,
    name: ctx.caller.name,
    scope: ctx.token.scope,
    expiresAt: ctx.token.expiresAt.toISOString(),
    sectors: sectors.map((sector) => ({
      id: sector.id,
      slug: sector.slug,
      name: sector.name,
      kind: sector.kind,
      role: sector.myRole === "spine-reader" ? (isOrgAdmin(ctx.caller) ? "admin" : "reader") : sector.myRole === "maintainer" ? "maintainer" : "reader",
    })),
  };
}

export const whoamiRoute = route(routes.whoami, whoami);
