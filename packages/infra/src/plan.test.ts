import { describe, expect, it } from "vitest";
import type { CurrentState, FunctionState } from "./plan";
import { emptyState, planChanges } from "./plan";
import { schema } from "./schema";
import type { SchemaSpec } from "./schema/types";

const bundles = { health: "a".repeat(64) };

function convergedState(desired: SchemaSpec): CurrentState {
  const tables: CurrentState["tables"] = {};
  for (const table of desired.tables) {
    tables[table.id] = {
      columns: Object.fromEntries(table.columns.map((column) => [column.key, { ...column }])),
      indexes: Object.fromEntries(table.indexes.map((index) => [index.key, { type: index.type, columns: index.columns }])),
    };
  }
  const functions: Record<string, FunctionState> = {};
  for (const fn of desired.functions) {
    functions[fn.id] = { ...fn, bundleHash: bundles.health };
  }
  return {
    vectorsDatabase: true,
    tablesDatabase: true,
    collections: Object.fromEntries(
      desired.collections.map((collection) => [
        collection.id,
        { dimension: collection.dimension, indexes: Object.fromEntries(collection.indexes.map((index) => [index.key, index.type])) },
      ]),
    ),
    tables,
    spine: true,
    functions,
  };
}

describe("planChanges", () => {
  it("plans every resource in dependency order on an empty project", () => {
    const { operations, drift } = planChanges(schema, emptyState, bundles);
    expect(drift).toEqual([]);
    const kinds = operations.map((operation) => operation.kind);
    expect(kinds.slice(0, 4)).toEqual(["createDatabase", "createDatabase", "createCollection", "createVectorIndex"]);
    expect(kinds.indexOf("createTable")).toBeLessThan(kinds.indexOf("createColumn"));
    expect(kinds.lastIndexOf("createColumn")).toBeLessThan(kinds.indexOf("ensureSpine"));
    expect(kinds.slice(-2)).toEqual(["ensureFunction", "deployFunction"]);
  });

  it("plans nothing on a converged project", () => {
    expect(planChanges(schema, convergedState(schema), bundles)).toEqual({ operations: [], drift: [] });
  });

  it("reports drift for a changed column and plans nothing for it", () => {
    const state = convergedState(schema);
    const files = state.tables.files;
    if (files === undefined) throw new Error("missing files table");
    files.columns.path = { type: "varchar", size: 256, required: true };
    const { operations, drift } = planChanges(schema, state, bundles);
    expect(operations).toEqual([]);
    expect(drift).toEqual([
      { resource: "table files column path", expected: "varchar required size=512", actual: "varchar required size=256" },
    ]);
  });

  it("plans only missing columns on a partial table", () => {
    const state = convergedState(schema);
    const sectors = state.tables.sectors;
    if (sectors === undefined) throw new Error("missing sectors table");
    delete sectors.columns.color;
    const { operations } = planChanges(schema, state, bundles);
    expect(operations).toEqual([
      { kind: "createColumn", tableId: "sectors", spec: { key: "color", type: "varchar", size: 7, required: true } },
    ]);
  });

  it("deploys a function only when the bundle hash differs", () => {
    const state = convergedState(schema);
    const changed = planChanges(schema, state, { health: "b".repeat(64) });
    expect(changed.operations.map((operation) => operation.kind)).toEqual(["deployFunction"]);
  });
});
