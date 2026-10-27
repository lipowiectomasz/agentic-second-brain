import type { Client } from "node-appwrite";
import { Functions, TablesDB, VectorsDB } from "node-appwrite";
import type { DatabaseIds } from "@cortex/config";
import { spineSectorId } from "@cortex/core";
import { withTimeout } from "@cortex/server-kit";
import { findOrNull } from "./appwrite-errors";
import type { ColumnState, CurrentState, FunctionState, IndexState } from "./plan";
import type { ColumnSpec, SchemaSpec } from "./schema/types";

export const bundleHashVariable = "CORTEX_BUNDLE_HASH";

interface RawColumn {
  key: string;
  type: string;
  required: boolean;
  size?: number;
  elements?: string[];
  format?: string;
  min?: number | bigint | null;
  max?: number | bigint | null;
}

function toColumnState(raw: RawColumn): ColumnState {
  const type = (raw.format === "enum" ? "enum" : raw.type) as ColumnSpec["type"];
  const state: ColumnState = { type, required: raw.required };
  if (type === "varchar" && raw.size !== undefined) state.size = raw.size;
  if (type === "enum" && raw.elements !== undefined) state.elements = raw.elements;
  if (type === "integer") {
    if (raw.min !== undefined && raw.min !== null && Number(raw.min) !== Number.MIN_SAFE_INTEGER && Number(raw.min) > -2147483648) state.min = Number(raw.min);
    if (raw.max !== undefined && raw.max !== null && Number(raw.max) < 2147483647) state.max = Number(raw.max);
  }
  return state;
}

export async function readCurrentState(client: Client, ids: DatabaseIds, desired: SchemaSpec): Promise<CurrentState> {
  const vectors = new VectorsDB(client);
  const tables = new TablesDB(client);
  const functions = new Functions(client);

  const vectorsDatabase = (await findOrNull(() => withTimeout("vectorsDB.get", () => vectors.get({ databaseId: ids.vectors })))) !== null;
  const tablesDatabase = (await findOrNull(() => withTimeout("tablesDB.get", () => tables.get({ databaseId: ids.tables })))) !== null;

  const state: CurrentState = { vectorsDatabase, tablesDatabase, collections: {}, tables: {}, spine: false, functions: {} };

  if (vectorsDatabase) {
    for (const spec of desired.collections) {
      const collection = await findOrNull(() =>
        withTimeout("vectorsDB.getCollection", () => vectors.getCollection({ databaseId: ids.vectors, collectionId: spec.id })),
      );
      if (collection === null) continue;
      state.collections[spec.id] = {
        dimension: collection.dimension,
        indexes: Object.fromEntries(collection.indexes.map((index) => [index.key, index.type])),
      };
    }
  }

  if (tablesDatabase) {
    for (const spec of desired.tables) {
      const table = await findOrNull(() => withTimeout("tablesDB.getTable", () => tables.getTable({ databaseId: ids.tables, tableId: spec.id })));
      if (table === null) continue;
      const indexes: Record<string, IndexState> = {};
      for (const index of table.indexes) indexes[index.key] = { type: index.type, columns: index.columns };
      state.tables[spec.id] = {
        columns: Object.fromEntries(table.columns.map((column) => [column.key, toColumnState(column as RawColumn)])),
        indexes,
      };
    }
    if (state.tables.sectors?.columns.slug !== undefined) {
      const spine = await findOrNull(() =>
        withTimeout("tablesDB.getRow", () => tables.getRow({ databaseId: ids.tables, tableId: "sectors", rowId: spineSectorId })),
      );
      state.spine = spine !== null;
    }
  }

  for (const spec of desired.functions) {
    const fn = await findOrNull(() => withTimeout("functions.get", () => functions.get({ functionId: spec.id })));
    if (fn === null) continue;
    const variables = await withTimeout("functions.listVariables", () => functions.listVariables({ functionId: spec.id }));
    const values = Object.fromEntries(variables.variables.map((variable) => [variable.key, variable.value]));
    const functionState: FunctionState = {
      runtime: fn.runtime,
      timeout: fn.timeout,
      logging: fn.logging,
      execute: fn.execute,
      scopes: fn.scopes,
      variables: values,
      bundleHash: fn.deploymentId === "" ? null : (values[bundleHashVariable] ?? null),
    };
    state.functions[spec.id] = functionState;
  }
  return state;
}
