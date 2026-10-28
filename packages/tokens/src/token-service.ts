import type { AuditSink } from "@cortex/audit";
import type { Caller } from "@cortex/server-kit";
import { ForbiddenError, isOrgAdmin } from "@cortex/server-kit";
import type { TokenScope } from "@cortex/gateway-contract";
import { TokenLimitReachedError, TokenNotFoundError } from "./errors";
import type { SessionPort, TokenRepository, UserDirectory } from "./repositories";
import { generateToken } from "./token-format";
import type { TokenRecord, TokenView } from "./token-record";
import { toTokenView } from "./token-record";

export const maxActiveTokens = 10;

export interface CreateTokenInput {
  name: string;
  scope: TokenScope;
  expiresInDays: 7 | 30 | 90;
}

export interface TokenServiceDeps {
  tokens: TokenRepository;
  sessions: SessionPort;
  users: UserDirectory;
  audit: AuditSink;
  now: () => Date;
  random: (size: number) => Buffer;
}

const dayMs = 24 * 60 * 60 * 1000;

export class TokenService {
  constructor(private readonly deps: TokenServiceDeps) {}

  async create(caller: Caller, input: CreateTokenInput): Promise<{ value: string; record: TokenView }> {
    const now = this.deps.now();
    if ((await this.deps.tokens.countActive(caller.userId, now)) >= maxActiveTokens) throw new TokenLimitReachedError(maxActiveTokens);
    const token = generateToken(this.deps.random);
    const record = await this.deps.tokens.insert({
      userId: caller.userId,
      name: input.name.trim(),
      prefix: token.prefix,
      tokenHash: token.hash,
      scope: input.scope,
      expiresAt: new Date(now.getTime() + input.expiresInDays * dayMs),
    });
    await this.audit(caller, "token.created", record, `${input.scope}, ${input.expiresInDays} days`);
    return { value: token.value, record: toTokenView(record, now) };
  }

  async revoke(caller: Caller, tokenId: string): Promise<void> {
    const record = await this.deps.tokens.findById(tokenId);
    if (record === null || (record.userId !== caller.userId && !isOrgAdmin(caller))) throw new TokenNotFoundError();
    if (record.revokedAt !== null) return;
    await this.deps.tokens.markRevoked(record.id, caller.userId, this.deps.now());
    if (record.sessionId !== null) await this.deps.sessions.deleteSession(record.userId, record.sessionId).catch(() => undefined);
    await this.audit(caller, "token.revoked", record, record.userId === caller.userId ? undefined : `owner ${record.userId}`);
  }

  async listOwn(caller: Caller): Promise<TokenView[]> {
    const now = this.deps.now();
    return (await this.deps.tokens.listByUser(caller.userId)).map((record) => toTokenView(record, now));
  }

  async listAll(caller: Caller): Promise<Array<TokenView & { ownerName: string }>> {
    if (!isOrgAdmin(caller)) throw new ForbiddenError("admin_only");
    const now = this.deps.now();
    const records = await this.deps.tokens.listAll();
    const owners = new Map<string, string>();
    for (const userId of new Set(records.map((record) => record.userId))) owners.set(userId, (await this.deps.users.getUser(userId))?.name ?? "Deleted user");
    return records.map((record) => ({ ...toTokenView(record, now), ownerName: owners.get(record.userId) ?? "Deleted user" }));
  }

  private async audit(caller: Caller, action: "token.created" | "token.revoked", record: TokenRecord, detail?: string): Promise<void> {
    await this.deps.audit.record({ actorId: caller.userId, actorName: caller.name, channel: caller.channel, action, target: `${record.id} cbt_${record.prefix}`, ...(detail === undefined ? {} : { detail }) });
  }
}
