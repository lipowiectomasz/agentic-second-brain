import { auditActions } from "@cortex/core";
import type { TableSpec } from "./types";

export const auditEventsTable: TableSpec = {
  id: "audit_events",
  name: "Audit events",
  columns: [
    { key: "actorId", type: "varchar", size: 36, required: true },
    { key: "actorName", type: "varchar", size: 128, required: true },
    { key: "action", type: "enum", elements: auditActions, required: true },
    { key: "channel", type: "enum", elements: ["web", "token", "system"], required: true },
    { key: "sectorId", type: "varchar", size: 36, required: false },
    { key: "target", type: "varchar", size: 512, required: true },
    { key: "detail", type: "varchar", size: 256, required: false },
  ],
  indexes: [
    { key: "action_idx", type: "key", columns: ["action"] },
    { key: "actor_idx", type: "key", columns: ["actorId"] },
    { key: "sector_idx", type: "key", columns: ["sectorId"] },
  ],
};
