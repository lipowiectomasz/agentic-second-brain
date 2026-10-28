import { createHash } from "node:crypto";
import type { Models, TablesDB } from "node-appwrite";
import { AppwriteException } from "node-appwrite";
import { withTimeout } from "@cortex/server-kit";
import type { FailureState } from "../failure-window";
import type { FailureRepository } from "../repositories";

export const tokenFailuresTableId = "token_failures";

type FailureRow = Models.Row & { key: string; count: number; windowStart: string; lockedUntil: string | null };

function rowIdFor(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 32);
}

export class AppwriteFailureRepository implements FailureRepository {
  constructor(
    private readonly tables: TablesDB,
    private readonly databaseId: string,
  ) {}

  async get(key: string): Promise<FailureState | null> {
    try {
      const row = await withTimeout("tablesDB.getRow failure", () => this.tables.getRow<FailureRow>({ databaseId: this.databaseId, tableId: tokenFailuresTableId, rowId: rowIdFor(key) }));
      return { count: row.count, windowStart: new Date(row.windowStart), lockedUntil: row.lockedUntil === null ? null : new Date(row.lockedUntil) };
    } catch (error) {
      if (error instanceof AppwriteException && error.code === 404) return null;
      throw error;
    }
  }

  async put(key: string, state: FailureState): Promise<void> {
    await withTimeout("tablesDB.upsertRow failure", () =>
      this.tables.upsertRow({
        databaseId: this.databaseId,
        tableId: tokenFailuresTableId,
        rowId: rowIdFor(key),
        data: { key, count: state.count, windowStart: state.windowStart.toISOString(), lockedUntil: state.lockedUntil?.toISOString() ?? null },
        permissions: [],
      }),
    );
  }

  async clear(key: string): Promise<void> {
    await withTimeout("tablesDB.deleteRow failure", () => this.tables.deleteRow({ databaseId: this.databaseId, tableId: tokenFailuresTableId, rowId: rowIdFor(key) })).catch((error: unknown) => {
      if (error instanceof AppwriteException && error.code === 404) return undefined;
      throw error;
    });
  }
}
