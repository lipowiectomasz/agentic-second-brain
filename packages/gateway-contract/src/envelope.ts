import { z } from "zod";
import { errorCodeSchema } from "./errors";

export const tokenScopeSchema = z.enum(["read", "write"]);
export type TokenScope = z.infer<typeof tokenScopeSchema>;

export const tokenPattern = /^cbt_[a-z2-7]{8}_[A-Za-z0-9_-]{43}$/;

export const gatewayRequestSchema = z.object({
  auth: z.string().length(56).regex(tokenPattern),
  input: z.unknown(),
});

export type GatewayRequest = z.infer<typeof gatewayRequestSchema>;

export const errorBodySchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: errorCodeSchema,
    message: z.string().max(300),
    details: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  }),
});

export type ErrorBody = z.infer<typeof errorBodySchema>;

export function okBody<T extends z.ZodType>(data: T) {
  return z.object({ ok: z.literal(true), data });
}

export const createTokenInputSchema = z.object({
  name: z.string().trim().min(1).max(64),
  scope: tokenScopeSchema,
  expiresInDays: z.coerce.number().pipe(z.union([z.literal(7), z.literal(30), z.literal(90)])),
});

export type CreateTokenFormInput = z.infer<typeof createTokenInputSchema>;
