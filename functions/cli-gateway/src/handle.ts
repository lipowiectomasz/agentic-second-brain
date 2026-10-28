import { AppwriteException } from "node-appwrite";
import { gatewayRequestSchema } from "@cortex/gateway-contract";
import type { AuthenticatedToken } from "@cortex/tokens";
import type { GatewayContext } from "./context";
import type { GatewayResponse } from "./map-error";
import { errorResponse, mapError } from "./map-error";
import type { RouteEntry } from "./router";

export const maxBodyBytes = 1024 * 1024;

export interface GatewayRequestShape {
  method: string;
  path: string;
  bodyText: string;
  clientIp: string;
}

export interface GatewayServices {
  lookup: (path: string) => RouteEntry | null;
  authenticate: (token: string, clientIp: string) => Promise<AuthenticatedToken>;
  context: (authenticated: AuthenticatedToken) => GatewayContext;
  forgetJwt?: (authenticated: AuthenticatedToken) => void;
  onError?: (error: unknown) => void;
}

function issuePaths(issues: Array<{ path: PropertyKey[] }>): string {
  return issues
    .map((issue) => issue.path.map(String).join(".") || "(root)")
    .slice(0, 10)
    .join(", ");
}

function isStaleJwt(error: unknown): boolean {
  return error instanceof AppwriteException && error.code === 401;
}

export async function handleRequest(request: GatewayRequestShape, services: GatewayServices): Promise<GatewayResponse> {
  if (request.method.toUpperCase() !== "POST") return errorResponse("bad_request", "Use POST.");
  if (Buffer.byteLength(request.bodyText, "utf8") > maxBodyBytes) return errorResponse("payload_too_large", "The request body exceeds 1 MiB.");
  let json: unknown;
  try {
    json = JSON.parse(request.bodyText);
  } catch {
    return errorResponse("bad_request", "The request body is not valid JSON.");
  }
  const envelope = gatewayRequestSchema.safeParse(json);
  if (!envelope.success) return errorResponse("bad_request", `Invalid request envelope: ${issuePaths(envelope.error.issues)}.`);
  const entry = services.lookup(request.path);
  if (entry === null) return errorResponse("not_found", "Unknown route.");
  try {
    const authenticated = await services.authenticate(envelope.data.auth, request.clientIp);
    if (entry.access === "write" && authenticated.record.scope === "read") return errorResponse("token_scope", "This token can only read.");
    const input = entry.input.safeParse(envelope.data.input ?? {});
    if (!input.success) return errorResponse("bad_request", `Invalid input: ${issuePaths(input.error.issues)}.`);
    let data: unknown;
    try {
      data = await entry.handler(services.context(authenticated), input.data as never);
    } catch (error) {
      if (!isStaleJwt(error) || services.forgetJwt === undefined) throw error;
      services.forgetJwt(authenticated);
      data = await entry.handler(services.context(await services.authenticate(envelope.data.auth, request.clientIp)), input.data as never);
    }
    return { status: 200, body: { ok: true, data } };
  } catch (error) {
    services.onError?.(error);
    return mapError(error);
  }
}
