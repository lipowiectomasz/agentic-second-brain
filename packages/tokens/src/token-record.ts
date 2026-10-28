import type { TokenScope } from "@cortex/gateway-contract";

export interface TokenRecord {
  id: string;
  userId: string;
  name: string;
  prefix: string;
  tokenHash: string;
  scope: TokenScope;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  sessionId: string | null;
}

export type TokenStatus = "active" | "expired" | "revoked";

export interface TokenView {
  id: string;
  name: string;
  prefix: string;
  scope: TokenScope;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  status: TokenStatus;
}

const touchIntervalMs = 5 * 60 * 1000;

export function isActive(record: Pick<TokenRecord, "revokedAt" | "expiresAt">, now: Date): boolean {
  return record.revokedAt === null && record.expiresAt.getTime() > now.getTime();
}

export function shouldTouchLastUsed(record: Pick<TokenRecord, "lastUsedAt">, now: Date): boolean {
  return record.lastUsedAt === null || now.getTime() - record.lastUsedAt.getTime() >= touchIntervalMs;
}

export function tokenStatus(record: Pick<TokenRecord, "revokedAt" | "expiresAt">, now: Date): TokenStatus {
  if (record.revokedAt !== null) return "revoked";
  return isActive(record, now) ? "active" : "expired";
}

export function toTokenView(record: TokenRecord, now: Date): TokenView {
  return {
    id: record.id,
    name: record.name,
    prefix: `cbt_${record.prefix}`,
    scope: record.scope,
    createdAt: record.createdAt.toISOString(),
    expiresAt: record.expiresAt.toISOString(),
    lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
    status: tokenStatus(record, now),
  };
}
