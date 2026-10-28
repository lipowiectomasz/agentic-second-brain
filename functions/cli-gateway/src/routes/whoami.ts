import type { WhoamiData } from "@cortex/gateway-contract";
import { routes } from "@cortex/gateway-contract";
import type { GatewayContext } from "../context";
import { route } from "../router";
import { sectorsFor } from "./manifest";

export async function whoami(ctx: GatewayContext): Promise<WhoamiData> {
  return {
    userId: ctx.caller.userId,
    name: ctx.caller.name,
    scope: ctx.token.scope,
    expiresAt: ctx.token.expiresAt.toISOString(),
    sectors: await sectorsFor(ctx),
  };
}

export const whoamiRoute = route(routes.whoami, whoami);
