import type { TableSpec } from "./types";

export const cliTokensTable: TableSpec = {
  id: "cli_tokens",
  name: "CLI tokens",
  columns: [
    { key: "userId", type: "varchar", size: 36, required: true },
    { key: "name", type: "varchar", size: 64, required: true },
    { key: "prefix", type: "varchar", size: 8, required: true },
    { key: "tokenHash", type: "varchar", size: 64, required: true },
    { key: "scope", type: "enum", elements: ["read", "write"], required: true },
    { key: "expiresAt", type: "datetime", required: true },
    { key: "lastUsedAt", type: "datetime", required: false },
    { key: "revokedAt", type: "datetime", required: false },
    { key: "revokedBy", type: "varchar", size: 36, required: false },
    { key: "sessionId", type: "varchar", size: 36, required: false },
  ],
  indexes: [
    { key: "user_idx", type: "key", columns: ["userId"] },
    { key: "prefix_unique", type: "unique", columns: ["prefix"] },
  ],
};

export const tokenFailuresTable: TableSpec = {
  id: "token_failures",
  name: "Token failures",
  columns: [
    { key: "key", type: "varchar", size: 80, required: true },
    { key: "count", type: "integer", min: 0, required: true },
    { key: "windowStart", type: "datetime", required: true },
    { key: "lockedUntil", type: "datetime", required: false },
  ],
  indexes: [{ key: "key_unique", type: "unique", columns: ["key"] }],
};
