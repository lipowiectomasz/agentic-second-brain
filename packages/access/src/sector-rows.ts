import type { Models, TablesDB } from "node-appwrite";
import { Query } from "node-appwrite";
import type { SectorKind } from "@cortex/core";
import { withTimeout } from "@cortex/server-kit";
import { SectorNotFoundError } from "./errors";
import type { AccessDeps, SectorRow } from "./types";

export const sectorsTableId = "sectors";

interface SectorRowData {
  slug: string;
  name: string;
  kind: SectorKind;
  teamId: string;
  color: string;
  description?: string | null;
}

export function toSectorRow(row: Models.Row & SectorRowData): SectorRow {
  return {
    id: row.$id,
    slug: row.slug,
    name: row.name,
    kind: row.kind,
    teamId: row.teamId,
    color: row.color,
    description: row.description ?? null,
  };
}

export async function listSectorRows(tables: TablesDB, databaseId: string): Promise<SectorRow[]> {
  const list = await withTimeout("tablesDB.listRows sectors", () =>
    tables.listRows<Models.Row & SectorRowData>({ databaseId, tableId: sectorsTableId, queries: [Query.orderAsc("name"), Query.limit(100)] }),
  );
  return list.rows.map(toSectorRow);
}

export async function getSectorRow(deps: AccessDeps, sectorId: string): Promise<SectorRow> {
  try {
    const row = await withTimeout("tablesDB.getRow sector", () =>
      deps.admin.tables.getRow<Models.Row & SectorRowData>({ databaseId: deps.ids.tables, tableId: sectorsTableId, rowId: sectorId }),
    );
    return toSectorRow(row);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 404) throw new SectorNotFoundError(sectorId);
    throw error;
  }
}
