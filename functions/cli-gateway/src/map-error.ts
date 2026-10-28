import type { ErrorBody, ErrorCode } from "@cortex/gateway-contract";
import { statusForCode } from "@cortex/gateway-contract";
import { ForbiddenError } from "@cortex/server-kit";
import { TokenInvalidError, TokenRateLimitedError } from "@cortex/tokens";

export class GatewayError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, string | number>,
  ) {
    super(message);
    this.name = "GatewayError";
  }
}

export interface GatewayResponse {
  status: number;
  body: unknown;
}

export function errorResponse(code: ErrorCode, message: string, details?: Record<string, string | number>): GatewayResponse {
  const body: ErrorBody = { ok: false, error: { code, message: message.slice(0, 300), ...(details === undefined ? {} : { details }) } };
  return { status: statusForCode(code), body };
}

export function mapError(error: unknown): GatewayResponse {
  if (error instanceof GatewayError) return errorResponse(error.code, error.message, error.details);
  if (error instanceof TokenRateLimitedError) return errorResponse("rate_limited", "Too many failed attempts. Try again later.", { retryAfter: error.retryAfterSeconds });
  if (error instanceof TokenInvalidError) return errorResponse("token_invalid", "The token is invalid, expired or revoked.");
  if (error instanceof ForbiddenError) return errorResponse("forbidden", "You do not have access to this resource.");
  return errorResponse("internal", "The gateway could not complete the request.");
}
