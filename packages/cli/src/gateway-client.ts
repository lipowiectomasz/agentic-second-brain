import type { z } from "zod";
import type { GatewayTarget } from "@cortex/gateway-contract";
import { callGateway, routes } from "@cortex/gateway-contract";
import { CliError, exitCodes } from "./errors";

type Routes = typeof routes;
export type RouteName = keyof Routes;
export type RouteInput<R extends RouteName> = z.input<Routes[R]["input"]>;
export type RouteData<R extends RouteName> = z.infer<Routes[R]["output"]>["data"];

const timeoutMs = 30_000;

export class GatewayClient {
  constructor(
    private readonly target: GatewayTarget,
    private readonly token: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async call<R extends RouteName>(name: R, input: RouteInput<R>): Promise<RouteData<R>> {
    const route = routes[name] as unknown as { path: string; output: z.ZodType<{ ok: true; data: RouteData<R> }> };
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const result = await callGateway(this.target, route, this.token, input, (url, init) => this.fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }));
        if (result.ok) return result.data;
        if (result.status >= 500 && attempt === 0) {
          lastError = new CliError(result.error.message, exitCodes.unreachable);
          continue;
        }
        throw toCliError(result.status, result.error.code, result.error.message, result.error.details);
      } catch (error) {
        if (error instanceof CliError) throw error;
        lastError = error;
      }
    }
    if (lastError instanceof CliError) throw lastError;
    throw new CliError("The Cortex server is unreachable.", exitCodes.unreachable);
  }
}

function toCliError(status: number, code: string, message: string, details?: Record<string, string | number>): CliError {
  if (code === "token_invalid") return new CliError("Your token is invalid, expired or revoked. Run cortex login.", exitCodes.auth, code);
  if (code === "rate_limited") return new CliError(`Too many failed attempts. Try again in ${details?.retryAfter ?? "a few"} seconds.`, exitCodes.rateLimited, code);
  if (code === "token_scope") return new CliError("This token can only read. Create a read and write token in the web app.", exitCodes.scope);
  if (code === "forbidden") return new CliError(message, exitCodes.scope);
  if (status >= 500) return new CliError("The Cortex server could not complete the request.", exitCodes.unreachable, code);
  return new CliError(message, exitCodes.unexpected, code);
}
