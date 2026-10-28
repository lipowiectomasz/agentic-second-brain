import type { TableSpec } from "./types";

export const proposalsTable: TableSpec = {
  id: "proposals",
  name: "Proposals",
  columns: [
    { key: "proposerId", type: "varchar", size: 36, required: true },
    { key: "proposerName", type: "varchar", size: 128, required: true },
    { key: "kind", type: "enum", elements: ["standard", "procedure"], required: true },
    { key: "targetPath", type: "varchar", size: 512, required: true },
    { key: "targetFileId", type: "varchar", size: 36, required: false },
    { key: "baseVersion", type: "integer", min: 1, required: false },
    { key: "title", type: "varchar", size: 200, required: true },
    { key: "rationale", type: "text", required: true },
    { key: "content", type: "mediumtext", required: true },
    { key: "sourceSectorId", type: "varchar", size: 36, required: false },
    { key: "sourcePath", type: "varchar", size: 512, required: false },
    { key: "channel", type: "enum", elements: ["web", "token"], required: true },
    { key: "status", type: "enum", elements: ["pending", "accepting", "accepted", "rejected", "withdrawn"], required: true },
    { key: "decidedBy", type: "varchar", size: 36, required: false },
    { key: "decidedAt", type: "datetime", required: false },
    { key: "decisionNote", type: "varchar", size: 1000, required: false },
    { key: "resultFileId", type: "varchar", size: 36, required: false },
    { key: "resultOutcome", type: "enum", elements: ["created", "updated", "merged", "overwritten", "unchanged"], required: false },
    { key: "overwrittenVersion", type: "integer", min: 1, required: false },
  ],
  indexes: [
    { key: "proposer_idx", type: "key", columns: ["proposerId"] },
    { key: "status_idx", type: "key", columns: ["status"] },
  ],
};
