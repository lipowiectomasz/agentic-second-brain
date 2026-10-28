import type { FailureState } from "./failure-window";
import type { TokenRecord } from "./token-record";

export type NewTokenRecord = Omit<TokenRecord, "id" | "createdAt" | "lastUsedAt" | "revokedAt" | "sessionId">;

export interface TokenRepository {
  findByPrefix(prefix: string): Promise<TokenRecord | null>;
  findById(id: string): Promise<TokenRecord | null>;
  listByUser(userId: string): Promise<TokenRecord[]>;
  listAll(): Promise<TokenRecord[]>;
  countActive(userId: string, now: Date): Promise<number>;
  insert(record: NewTokenRecord): Promise<TokenRecord>;
  markRevoked(id: string, revokedBy: string, at: Date): Promise<void>;
  touchLastUsed(id: string, at: Date): Promise<void>;
  setSession(id: string, sessionId: string): Promise<void>;
}

export interface FailureRepository {
  get(key: string): Promise<FailureState | null>;
  put(key: string, state: FailureState): Promise<void>;
  clear(key: string): Promise<void>;
}

export interface SessionPort {
  createSession(userId: string): Promise<string>;
  deleteSession(userId: string, sessionId: string): Promise<void>;
  createJwt(userId: string, sessionId: string, durationSeconds: number): Promise<{ jwt: string } | { sessionMissing: true }>;
}

export interface TokenOwner {
  name: string;
  email: string;
  labels: string[];
}

export interface UserDirectory {
  getUser(userId: string): Promise<TokenOwner | null>;
}
