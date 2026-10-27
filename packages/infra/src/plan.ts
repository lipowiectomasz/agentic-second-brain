import type { CollectionSpec, ColumnSpec, FunctionSpec, IndexSpec, SchemaSpec, TableSpec, VectorIndexSpec } from "./schema/types";

export interface ColumnState {
  type: ColumnSpec["type"];
  required: boolean;
  size?: number;
  elements?: readonly string[];
  min?: number;
  max?: number;
}

export interface IndexState {
  type: string;
  columns: string[];
}

export interface FunctionState {
  runtime: string;
  timeout: number;
  logging: boolean;
  execute: string[];
  scopes: string[];
  variables: Record<string, string>;
  bundleHash: string | null;
}

export interface CurrentState {
  vectorsDatabase: boolean;
  tablesDatabase: boolean;
  collections: Record<string, { dimension: number; indexes: Record<string, string> }>;
  tables: Record<string, { columns: Record<string, ColumnState>; indexes: Record<string, IndexState> }>;
  spine: boolean;
  functions: Record<string, FunctionState>;
}

export type Operation =
  | { kind: "createDatabase"; engine: "vectors" | "tables" }
  | { kind: "createCollection"; spec: CollectionSpec }
  | { kind: "createVectorIndex"; collectionId: string; spec: VectorIndexSpec }
  | { kind: "createTable"; spec: TableSpec }
  | { kind: "createColumn"; tableId: string; spec: ColumnSpec }
  | { kind: "createIndex"; tableId: string; spec: IndexSpec }
  | { kind: "ensureSpine" }
  | { kind: "ensureFunction"; spec: FunctionSpec; exists: boolean }
  | { kind: "deployFunction"; spec: FunctionSpec; bundleHash: string };

export interface Drift {
  resource: string;
  expected: string;
  actual: string;
}

export interface Plan {
  operations: Operation[];
  drift: Drift[];
}

export const emptyState: CurrentState = {
  vectorsDatabase: false,
  tablesDatabase: false,
  collections: {},
  tables: {},
  spine: false,
  functions: {},
};

export function describeColumn(spec: ColumnSpec | ColumnState): string {
  const parts: string[] = [spec.type, spec.required ? "required" : "optional"];
  if ("size" in spec && spec.size !== undefined) parts.push(`size=${spec.size}`);
  if ("elements" in spec && spec.elements !== undefined) parts.push(`elements=${[...spec.elements].join("|")}`);
  if ("min" in spec && spec.min !== undefined) parts.push(`min=${spec.min}`);
  if ("max" in spec && spec.max !== undefined) parts.push(`max=${spec.max}`);
  return parts.join(" ");
}

function functionSettingsMatch(spec: FunctionSpec, state: FunctionState): boolean {
  const sorted = (values: string[]) => [...values].sort().join(",");
  const variablesMatch = Object.entries(spec.variables).every(([key, value]) => state.variables[key] === value);
  return (
    state.runtime === spec.runtime &&
    state.timeout === spec.timeout &&
    state.logging === spec.logging &&
    sorted(state.execute) === sorted(spec.execute) &&
    sorted(state.scopes) === sorted(spec.scopes) &&
    variablesMatch
  );
}

function planTable(spec: TableSpec, state: CurrentState["tables"][string] | undefined, plan: Plan): void {
  if (state === undefined) {
    plan.operations.push({ kind: "createTable", spec });
  }
  for (const column of spec.columns) {
    const existing = state?.columns[column.key];
    if (existing === undefined) {
      plan.operations.push({ kind: "createColumn", tableId: spec.id, spec: column });
      continue;
    }
    const expected = describeColumn(column);
    const actual = describeColumn(existing);
    if (expected !== actual) {
      plan.drift.push({ resource: `table ${spec.id} column ${column.key}`, expected, actual });
    }
  }
  for (const index of spec.indexes) {
    const existing = state?.indexes[index.key];
    if (existing === undefined) {
      plan.operations.push({ kind: "createIndex", tableId: spec.id, spec: index });
      continue;
    }
    const expected = `${index.type} ${index.columns.join(",")}`;
    const actual = `${existing.type} ${existing.columns.join(",")}`;
    if (expected !== actual) {
      plan.drift.push({ resource: `table ${spec.id} index ${index.key}`, expected, actual });
    }
  }
}

export function planChanges(desired: SchemaSpec, current: CurrentState, bundles: Record<string, string>): Plan {
  const plan: Plan = { operations: [], drift: [] };
  if (!current.vectorsDatabase) plan.operations.push({ kind: "createDatabase", engine: "vectors" });
  if (!current.tablesDatabase) plan.operations.push({ kind: "createDatabase", engine: "tables" });

  for (const collection of desired.collections) {
    const existing = current.collections[collection.id];
    if (existing === undefined) {
      plan.operations.push({ kind: "createCollection", spec: collection });
    } else if (existing.dimension !== collection.dimension) {
      plan.drift.push({
        resource: `collection ${collection.id}`,
        expected: `dimension=${collection.dimension}`,
        actual: `dimension=${existing.dimension}`,
      });
    }
    for (const index of collection.indexes) {
      const existingType = existing?.indexes[index.key];
      if (existingType === undefined) {
        plan.operations.push({ kind: "createVectorIndex", collectionId: collection.id, spec: index });
      } else if (existingType !== index.type) {
        plan.drift.push({ resource: `collection ${collection.id} index ${index.key}`, expected: index.type, actual: existingType });
      }
    }
  }

  for (const table of desired.tables) {
    planTable(table, current.tables[table.id], plan);
  }

  if (!current.spine) plan.operations.push({ kind: "ensureSpine" });

  for (const fn of desired.functions) {
    const existing = current.functions[fn.id];
    if (existing === undefined || !functionSettingsMatch(fn, existing)) {
      plan.operations.push({ kind: "ensureFunction", spec: fn, exists: existing !== undefined });
    }
    const bundleHash = bundles[fn.id];
    if (bundleHash !== undefined && existing?.bundleHash !== bundleHash) {
      plan.operations.push({ kind: "deployFunction", spec: fn, bundleHash });
    }
  }
  return plan;
}

export function describeOperation(operation: Operation): string {
  switch (operation.kind) {
    case "createDatabase":
      return `create ${operation.engine} database`;
    case "createCollection":
      return `create collection ${operation.spec.id} (dimension ${operation.spec.dimension})`;
    case "createVectorIndex":
      return `create index ${operation.spec.key} on ${operation.collectionId}`;
    case "createTable":
      return `create table ${operation.spec.id}`;
    case "createColumn":
      return `create column ${operation.tableId}.${operation.spec.key} (${describeColumn(operation.spec)})`;
    case "createIndex":
      return `create index ${operation.tableId}.${operation.spec.key}`;
    case "ensureSpine":
      return "create spine sector and team";
    case "ensureFunction":
      return `${operation.exists ? "update" : "create"} function ${operation.spec.id}`;
    case "deployFunction":
      return `deploy function ${operation.spec.id} (${operation.bundleHash.slice(0, 12)})`;
  }
}
