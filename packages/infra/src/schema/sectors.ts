import { sectorKinds } from "@cortex/core";
import type { TableSpec } from "./types";

export const sectorsTable: TableSpec = {
  id: "sectors",
  name: "Sectors",
  columns: [
    { key: "slug", type: "varchar", size: 64, required: true },
    { key: "name", type: "varchar", size: 128, required: true },
    { key: "kind", type: "enum", elements: sectorKinds, required: true },
    { key: "teamId", type: "varchar", size: 36, required: true },
    { key: "description", type: "varchar", size: 512, required: false },
    { key: "color", type: "varchar", size: 7, required: true },
  ],
  indexes: [
    { key: "slug_unique", type: "unique", columns: ["slug"] },
    { key: "team_unique", type: "unique", columns: ["teamId"] },
  ],
};
