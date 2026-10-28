import { z } from "zod";
import { okBody, tokenScopeSchema } from "./envelope";
import { syncRoutes } from "./sync-routes";

export const whoamiDataSchema = z.object({
  userId: z.string(),
  name: z.string(),
  scope: tokenScopeSchema,
  expiresAt: z.iso.datetime(),
  sectors: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      name: z.string(),
      kind: z.enum(["spine", "project"]),
      role: z.enum(["reader", "maintainer", "admin"]),
    }),
  ),
});

export type WhoamiData = z.infer<typeof whoamiDataSchema>;

export const routes = {
  whoami: { path: "/v1/whoami", access: "read", input: z.object({}).strict(), output: okBody(whoamiDataSchema) },
  ...syncRoutes,
} as const;

export type RouteName = keyof typeof routes;
export type RouteAccess = "read" | "write";
