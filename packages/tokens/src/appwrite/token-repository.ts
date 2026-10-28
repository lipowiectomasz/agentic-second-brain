import type { Models } from "node-appwrite";
import type { TablesDB } from "node-appwrite";
import { AppwriteException, ID, Permission, Query, Role } from "node-appwrite";
import { adminLabel } from "@cortex/core";
import { withTimeout } from "@cortex/server-kit";
import type { NewTokenRecord, TokenRepository } from "../repositories";
import type { TokenRecord } from "../token-record";

export const cliTokensTableId = "cli_tokens";

type TokenRow = Models.Row & {
  userId: string;
  name: string;
  prefix: string;
  tokenHash: string;
  scope: "read" | "write";
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  sessionId: string | null;
};

const pageSize = 100;

function toRecord(row: TokenRow): TokenRecord {
  return {
    id: row.$id,
    userId: row.userId,
    name: row.name,
    prefix: row.prefix,
    tokenHash: row.tokenHash,
    scope: row.scope,
    createdAt: new Date(row.$createdAt),
    expiresAt: new Date(row.expiresAt),
    lastUsedAt: row.lastUsedAt === null ? null : new Date(row.lastUsedAt),
    revokedAt: row.revokedAt === null ? null : new Date(row.revokedAt),
    sessionId: row.sessionId,
  };
}

export class AppwriteTokenRepository implements TokenRepository {
  constructor(
    private readonly tables: TablesDB,
    private readonly databaseId: string,
  ) {}

  async findByPrefix(prefix: string): Promise<TokenRecord | null> {
    const list = await this.list([Query.equal("prefix", [prefix]), Query.limit(1)]);
    return list[0] ?? null;
  }

  async findById(id: string): Promise<TokenRecord | null> {
    try {
      return toRecord(await withTimeout("tablesDB.getRow token", () => this.tables.getRow<TokenRow>({ databaseId: this.databaseId, tableId: cliTokensTableId, rowId: id })));
    } catch (error) {
      if (error instanceof AppwriteException && (error.code === 404 || error.code === 400)) return null;
      throw error;
    }
  }

  async listByUser(userId: string): Promise<TokenRecord[]> {
    return this.list([Query.equal("userId", [userId]), Query.orderDesc("$createdAt"), Query.limit(pageSize)]);
  }

  async listAll(): Promise<TokenRecord[]> {
    return this.list([Query.orderDesc("$createdAt"), Query.limit(pageSize)]);
  }

  async countActive(userId: string, now: Date): Promise<number> {
    const list = await withTimeout("tablesDB.listRows active tokens", () =>
      this.tables.listRows({
        databaseId: this.databaseId,
        tableId: cliTokensTableId,
        queries: [Query.equal("userId", [userId]), Query.isNull("revokedAt"), Query.greaterThan("expiresAt", now.toISOString()), Query.select(["$id"]), Query.limit(1)],
        total: true,
      }),
    );
    return list.total;
  }

  async insert(record: NewTokenRecord): Promise<TokenRecord> {
    const row = await withTimeout("tablesDB.createRow token", () =>
      this.tables.createRow<TokenRow>({
        databaseId: this.databaseId,
        tableId: cliTokensTableId,
        rowId: ID.unique(),
        data: { userId: record.userId, name: record.name, prefix: record.prefix, tokenHash: record.tokenHash, scope: record.scope, expiresAt: record.expiresAt.toISOString(), lastUsedAt: null, revokedAt: null, sessionId: null },
        permissions: [Permission.read(Role.user(record.userId)), Permission.read(Role.label(adminLabel))],
      }),
    );
    return toRecord(row);
  }

  async markRevoked(id: string, revokedBy: string, at: Date): Promise<void> {
    await this.update(id, { revokedAt: at.toISOString(), revokedBy });
  }

  async touchLastUsed(id: string, at: Date): Promise<void> {
    await this.update(id, { lastUsedAt: at.toISOString() });
  }

  async setSession(id: string, sessionId: string): Promise<void> {
    await this.update(id, { sessionId });
  }

  private async update(id: string, data: Record<string, string>): Promise<void> {
    await withTimeout("tablesDB.updateRow token", () => this.tables.updateRow({ databaseId: this.databaseId, tableId: cliTokensTableId, rowId: id, data }));
  }

  private async list(queries: string[]): Promise<TokenRecord[]> {
    const list = await withTimeout("tablesDB.listRows tokens", () => this.tables.listRows<TokenRow>({ databaseId: this.databaseId, tableId: cliTokensTableId, queries }));
    return list.rows.map(toRecord);
  }
}
