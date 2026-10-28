import type { z } from "zod";
import type { RouteAccess } from "@cortex/gateway-contract";
import type { GatewayContext } from "./context";

export type Handler<I, O> = (ctx: GatewayContext, input: I) => Promise<O>;

export interface RouteEntry {
  access: RouteAccess;
  input: z.ZodType;
  handler: Handler<never, unknown>;
}

export function route<I extends z.ZodType, O>(contract: { path: string; access: RouteAccess; input: I }, handler: Handler<z.infer<I>, O>): [string, RouteEntry] {
  return [contract.path, { access: contract.access, input: contract.input, handler: handler as Handler<never, unknown> }];
}

export function createRouter(entries: Array<[string, RouteEntry]>): (path: string) => RouteEntry | null {
  const table = new Map(entries);
  return (path) => table.get(path.split("?")[0] ?? path) ?? null;
}
