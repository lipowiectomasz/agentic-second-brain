import type { ErrorBody, ErrorCode } from "@cortex/gateway-contract";
import { statusForCode } from "@cortex/gateway-contract";
import { ForbiddenError } from "@cortex/server-kit";
import { KnowledgeError } from "@cortex/knowledge";
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
  if (error instanceof KnowledgeError) return knowledgeResponse(error);
  return errorResponse("internal", "The gateway could not complete the request.");
}

function knowledgeResponse(error: KnowledgeError): GatewayResponse {
  switch (error.details.code) {
    case "invalid_input":
      return errorResponse("bad_request", `Invalid input: ${error.details.issues.slice(0, 5).join(", ")}.`);
    case "forbidden":
    case "not_author":
      return errorResponse("forbidden", "You do not have access to this resource.");
    case "sector_not_found":
    case "doc_not_found":
    case "not_found":
      return errorResponse("not_found", "Not found.");
    case "invalid_transition":
      return errorResponse("version_conflict", `Status cannot change from ${error.details.from ?? "none"} to ${error.details.to}.`);
    case "immutable":
      return errorResponse("forbidden", "This document is approved and read-only.");
    case "secret_detected":
      return errorResponse("secret_detected", "The content looks like it contains a secret.", { line: error.details.findings[0]?.line ?? 0 });
    case "too_large":
      return errorResponse("payload_too_large", "The file is too large.");
    default:
      return errorResponse("internal", "The gateway could not complete the request.");
  }
}
