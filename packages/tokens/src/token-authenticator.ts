import type { Caller } from "@cortex/server-kit";
import { toCaller } from "@cortex/server-kit";
import { TokenInvalidError, TokenRateLimitedError, TokenSessionError } from "./errors";
import type { FailurePolicy } from "./failure-window";
import { ipPolicy, isLocked, prefixPolicy, registerFailure } from "./failure-window";
import type { FailureRepository, SessionPort, TokenRepository, UserDirectory } from "./repositories";
import { parseToken, verifySecret } from "./token-format";
import type { TokenRecord } from "./token-record";
import { isActive, shouldTouchLastUsed } from "./token-record";

export interface AuthenticatedToken {
  record: TokenRecord;
  jwt: string;
  caller: Caller;
}

export interface TokenAuthenticatorDeps {
  tokens: TokenRepository;
  failures: FailureRepository;
  sessions: SessionPort;
  users: UserDirectory;
  now: () => Date;
  jwtCache: Map<string, { jwt: string; expiresAt: number }>;
}

export const jwtDurationSeconds = 900;
const jwtReuseMarginMs = 60_000;

export class TokenAuthenticator {
  constructor(private readonly deps: TokenAuthenticatorDeps) {}

  async authenticate(value: string, clientIp: string): Promise<AuthenticatedToken> {
    const now = this.deps.now();
    const ipKey = `ip:${clientIp}`;
    await this.ensureUnlocked(ipKey, now);
    const parsed = parseToken(value);
    if (parsed === null) return this.fail([[ipKey, ipPolicy]], now);
    const prefixKey = `prefix:${parsed.prefix}`;
    await this.ensureUnlocked(prefixKey, now);
    const failures: Array<[string, FailurePolicy]> = [
      [ipKey, ipPolicy],
      [prefixKey, prefixPolicy],
    ];
    const record = await this.deps.tokens.findByPrefix(parsed.prefix);
    if (record === null || !verifySecret(value, record.tokenHash) || !isActive(record, now)) return this.fail(failures, now);
    const owner = await this.deps.users.getUser(record.userId);
    if (owner === null) return this.fail(failures, now);
    const jwt = await this.jwtFor(record, now);
    await this.deps.failures.clear(prefixKey);
    if (shouldTouchLastUsed(record, now)) await this.deps.tokens.touchLastUsed(record.id, now);
    return { record, jwt, caller: toCaller({ $id: record.userId, name: owner.name, email: owner.email, labels: owner.labels }, "token", record.scope) };
  }

  forgetJwt(recordId: string): void {
    this.deps.jwtCache.delete(recordId);
  }

  private async ensureUnlocked(key: string, now: Date): Promise<void> {
    const state = isLocked(await this.deps.failures.get(key), now);
    if (state.locked) throw new TokenRateLimitedError(state.retryAfterSeconds);
  }

  private async fail(keys: Array<[string, FailurePolicy]>, now: Date): Promise<never> {
    for (const [key, policy] of keys) await this.deps.failures.put(key, registerFailure(await this.deps.failures.get(key), policy, now));
    throw new TokenInvalidError();
  }

  private async jwtFor(record: TokenRecord, now: Date): Promise<string> {
    const cached = this.deps.jwtCache.get(record.id);
    if (cached !== undefined && cached.expiresAt - jwtReuseMarginMs > now.getTime()) return cached.jwt;
    let sessionId = record.sessionId;
    let minted = sessionId === null ? ({ sessionMissing: true } as const) : await this.deps.sessions.createJwt(record.userId, sessionId, jwtDurationSeconds);
    if ("sessionMissing" in minted) {
      sessionId = await this.deps.sessions.createSession(record.userId);
      await this.deps.tokens.setSession(record.id, sessionId);
      minted = await this.deps.sessions.createJwt(record.userId, sessionId, jwtDurationSeconds);
      if ("sessionMissing" in minted) throw new TokenSessionError();
    }
    this.deps.jwtCache.set(record.id, { jwt: minted.jwt, expiresAt: now.getTime() + jwtDurationSeconds * 1000 });
    return minted.jwt;
  }
}
