import { sectorRoles } from "@cortex/core";
import type { TableSpec } from "./types";

export const accessRequestsTable: TableSpec = {
  id: "access_requests",
  name: "Access requests",
  columns: [
    { key: "userId", type: "varchar", size: 36, required: true },
    { key: "userName", type: "varchar", size: 128, required: true },
    { key: "sectorId", type: "varchar", size: 36, required: true },
    { key: "role", type: "enum", elements: sectorRoles, required: true },
    { key: "status", type: "enum", elements: ["pending", "approved", "rejected"], required: true },
    { key: "message", type: "varchar", size: 280, required: false },
    { key: "decidedBy", type: "varchar", size: 36, required: false },
    { key: "decidedAt", type: "datetime", required: false },
  ],
  indexes: [
    { key: "sector_status_idx", type: "key", columns: ["sectorId", "status"] },
    { key: "user_idx", type: "key", columns: ["userId"] },
  ],
};
