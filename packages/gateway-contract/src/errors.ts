import { z } from "zod";

export const errorCodeSchema = z.enum([
  "bad_request",
  "token_invalid",
  "token_scope",
  "forbidden",
  "not_found",
  "version_conflict",
  "payload_too_large",
  "secret_detected",
  "rate_limited",
  "internal",
]);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

const statuses: Record<ErrorCode, number> = {
  bad_request: 400,
  token_invalid: 401,
  token_scope: 403,
  forbidden: 403,
  not_found: 404,
  version_conflict: 409,
  payload_too_large: 413,
  secret_detected: 422,
  rate_limited: 429,
  internal: 500,
};

export function statusForCode(code: ErrorCode): number {
  return statuses[code];
}
