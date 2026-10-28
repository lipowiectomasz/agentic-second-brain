import type { FailureState } from "./failure-window";
import type { FailureRepository, NewTokenRecord, SessionPort, TokenOwner, TokenRepository, UserDirectory } from "./repositories";
import type { TokenRecord } from "./token-record";
import { isActive } from "./token-record";

export class MemoryTokenRepository implements TokenRepository {
  readonly rows = new Map<string, TokenRecord>();
  touches = 0;
  private sequence = 0;

  constructor(private readonly now: () => Date) {}

  async findByPrefix(prefix: string) {
    return [...this.rows.values()].find((row) => row.prefix === prefix) ?? null;
  }

  async findById(id: string) {
    return this.rows.get(id) ?? null;
  }

  async listByUser(userId: string) {
    return [...this.rows.values()].filter((row) => row.userId === userId);
  }

  async listAll() {
    return [...this.rows.values()];
  }

  async countActive(userId: string, now: Date) {
    return (await this.listByUser(userId)).filter((row) => isActive(row, now)).length;
  }

  async insert(record: NewTokenRecord) {
    this.sequence += 1;
    const row: TokenRecord = { ...record, id: `t${this.sequence}`, createdAt: this.now(), lastUsedAt: null, revokedAt: null, sessionId: null };
    this.rows.set(row.id, row);
    return row;
  }

  async markRevoked(id: string, _revokedBy: string, at: Date) {
    const row = this.rows.get(id);
    if (row !== undefined) this.rows.set(id, { ...row, revokedAt: at });
  }

  async touchLastUsed(id: string, at: Date) {
    this.touches += 1;
    const row = this.rows.get(id);
    if (row !== undefined) this.rows.set(id, { ...row, lastUsedAt: at });
  }

  async setSession(id: string, sessionId: string) {
    const row = this.rows.get(id);
    if (row !== undefined) this.rows.set(id, { ...row, sessionId });
  }
}

export class MemoryFailureRepository implements FailureRepository {
  readonly rows = new Map<string, FailureState>();

  async get(key: string) {
    return this.rows.get(key) ?? null;
  }

  async put(key: string, state: FailureState) {
    this.rows.set(key, state);
  }

  async clear(key: string) {
    this.rows.delete(key);
  }
}

export class MemorySessions implements SessionPort {
  readonly sessions = new Set<string>();
  created = 0;

  async createSession(userId: string) {
    this.created += 1;
    const id = `${userId}-s${this.created}`;
    this.sessions.add(id);
    return id;
  }

  async deleteSession(_userId: string, sessionId: string) {
    this.sessions.delete(sessionId);
  }

  async createJwt(_userId: string, sessionId: string) {
    return this.sessions.has(sessionId) ? { jwt: `jwt-${sessionId}` } : ({ sessionMissing: true } as const);
  }
}

export class MemoryUsers implements UserDirectory {
  constructor(readonly users: Record<string, TokenOwner>) {}

  async getUser(userId: string) {
    return this.users[userId] ?? null;
  }
}
