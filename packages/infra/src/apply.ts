import type { Client } from "node-appwrite";
import { Functions, Permission, Role, TablesDB, TablesDBIndexType, Teams, VectorsDB, VectorsDBIndexType } from "node-appwrite";
import type { Runtime, ProjectKeyScopes } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import type { DatabaseIds } from "@cortex/config";
import { sectorTeamId, spineSectorId } from "@cortex/core";
import { withTimeout } from "@cortex/server-kit";
import { findOrNull } from "./appwrite-errors";
import { bundleHashVariable } from "./current-state";
import type { Operation } from "./plan";
import { describeOperation } from "./plan";
import type { ColumnSpec, FunctionSpec } from "./schema/types";

const availabilityLimitMs = 120_000;
const deploymentLimitMs = 300_000;
const pollIntervalMs = 1_000;

const spineColor = "#d4a24c";

export interface ApplyContext {
  client: Client;
  ids: DatabaseIds;
  bundles: Record<string, string>;
  archives: Record<string, string>;
  log: (line: string) => void;
}

async function waitUntil(description: string, limitMs: number, check: () => Promise<"ready" | "pending">): Promise<void> {
  const deadline = Date.now() + limitMs;
  while (Date.now() < deadline) {
    if ((await check()) === "ready") return;
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  throw new Error(`${description} did not become available within ${limitMs / 1000} s`);
}

async function createColumn(tables: TablesDB, databaseId: string, tableId: string, spec: ColumnSpec): Promise<void> {
  const base = { databaseId, tableId, key: spec.key, required: spec.required };
  switch (spec.type) {
    case "varchar":
      await tables.createVarcharColumn({ ...base, size: spec.size });
      return;
    case "text":
      await tables.createTextColumn(base);
      return;
    case "mediumtext":
      await tables.createMediumtextColumn(base);
      return;
    case "enum":
      await tables.createEnumColumn({ ...base, elements: [...spec.elements] });
      return;
    case "integer":
      await tables.createIntegerColumn({ ...base, ...(spec.min === undefined ? {} : { min: spec.min }), ...(spec.max === undefined ? {} : { max: spec.max }) });
      return;
    case "boolean":
      await tables.createBooleanColumn(base);
      return;
    case "datetime":
      await tables.createDatetimeColumn(base);
      return;
  }
}

async function waitForTableResources(tables: TablesDB, databaseId: string, tableId: string): Promise<void> {
  await waitUntil(`table ${tableId} columns and indexes`, availabilityLimitMs, async () => {
    const table = await withTimeout("tablesDB.getTable", () => tables.getTable({ databaseId, tableId }));
    const statuses = [...table.columns.map((column) => String(column.status)), ...table.indexes.map((index) => index.status)];
    const failed = statuses.find((status) => status === "failed" || status === "stuck");
    if (failed !== undefined) throw new Error(`table ${tableId} has a ${failed} column or index`);
    return statuses.every((status) => status === "available") ? "ready" : "pending";
  });
}

async function ensureSpine(context: ApplyContext): Promise<void> {
  const teams = new Teams(context.client);
  const tables = new TablesDB(context.client);
  const teamId = sectorTeamId(spineSectorId);
  const team = await findOrNull(() => withTimeout("teams.get", () => teams.get({ teamId })));
  if (team === null) {
    await withTimeout("teams.create", () => teams.create({ teamId, name: "Spine" }));
  }
  await withTimeout("tablesDB.createRow", () =>
    tables.createRow({
      databaseId: context.ids.tables,
      tableId: "sectors",
      rowId: spineSectorId,
      data: { slug: spineSectorId, name: "Spine", kind: "spine", teamId, description: "Shared by the whole organisation", color: spineColor },
      permissions: [Permission.read(Role.users())],
    }),
  );
}

async function ensureFunction(context: ApplyContext, spec: FunctionSpec, exists: boolean): Promise<void> {
  const functions = new Functions(context.client);
  const settings = {
    functionId: spec.id,
    name: spec.name,
    runtime: spec.runtime as Runtime,
    execute: spec.execute,
    timeout: spec.timeout,
    logging: spec.logging,
    entrypoint: "main.mjs",
    commands: "",
    scopes: spec.scopes as ProjectKeyScopes[],
  };
  if (exists) {
    await withTimeout("functions.update", () => functions.update(settings));
  } else {
    await withTimeout("functions.create", () => functions.create(settings));
  }
  for (const [key, value] of Object.entries(spec.variables)) {
    await upsertVariable(functions, spec.id, key, value);
  }
}

async function upsertVariable(functions: Functions, functionId: string, key: string, value: string): Promise<void> {
  const list = await withTimeout("functions.listVariables", () => functions.listVariables({ functionId }));
  const existing = list.variables.find((variable) => variable.key === key);
  if (existing === undefined) {
    await withTimeout("functions.createVariable", () => functions.createVariable({ functionId, variableId: "unique()", key, value, secret: false }));
  } else if (existing.value !== value) {
    await withTimeout("functions.updateVariable", () => functions.updateVariable({ functionId, variableId: existing.$id, key, value }));
  }
}

async function deployFunction(context: ApplyContext, spec: FunctionSpec, bundleHash: string): Promise<void> {
  const functions = new Functions(context.client);
  const archive = context.archives[spec.id];
  if (archive === undefined) throw new Error(`No bundle built for function ${spec.id}`);
  const deployment = await withTimeout(
    "functions.createDeployment",
    () => functions.createDeployment({ functionId: spec.id, code: InputFile.fromPath(archive, `${spec.id}.tar.gz`), activate: true }),
    120_000,
  );
  await waitUntil(`deployment of ${spec.id}`, deploymentLimitMs, async () => {
    const current = await withTimeout("functions.getDeployment", () => functions.getDeployment({ functionId: spec.id, deploymentId: deployment.$id }));
    if (current.status === "failed" || current.status === "canceled") throw new Error(`deployment of ${spec.id} ${current.status}`);
    return current.status === "ready" ? "ready" : "pending";
  });
  await upsertVariable(functions, spec.id, bundleHashVariable, bundleHash);
}

export async function applyOperations(context: ApplyContext, operations: Operation[]): Promise<void> {
  const vectors = new VectorsDB(context.client);
  const tables = new TablesDB(context.client);
  const touchedTables = new Set<string>();

  for (const operation of operations) {
    context.log(`  ${describeOperation(operation)}`);
    switch (operation.kind) {
      case "createDatabase":
        if (operation.engine === "vectors") {
          await withTimeout("vectorsDB.create", () => vectors.create({ databaseId: context.ids.vectors, name: "Cortex vectors" }));
        } else {
          await withTimeout("tablesDB.create", () => tables.create({ databaseId: context.ids.tables, name: "Cortex tables" }));
        }
        break;
      case "createCollection":
        await withTimeout("vectorsDB.createCollection", () =>
          vectors.createCollection({
            databaseId: context.ids.vectors,
            collectionId: operation.spec.id,
            name: operation.spec.name,
            dimension: operation.spec.dimension,
            documentSecurity: true,
            permissions: [],
          }),
        );
        break;
      case "createVectorIndex":
        await withTimeout("vectorsDB.createIndex", () =>
          vectors.createIndex({
            databaseId: context.ids.vectors,
            collectionId: operation.collectionId,
            key: operation.spec.key,
            type: VectorsDBIndexType.HnswCosine,
            attributes: ["embeddings"],
          }),
        );
        break;
      case "createTable":
        await withTimeout("tablesDB.createTable", () =>
          tables.createTable({ databaseId: context.ids.tables, tableId: operation.spec.id, name: operation.spec.name, rowSecurity: true, permissions: [] }),
        );
        break;
      case "createColumn":
        await withTimeout("tablesDB.createColumn", () => createColumn(tables, context.ids.tables, operation.tableId, operation.spec));
        touchedTables.add(operation.tableId);
        break;
      case "createIndex":
        await waitForTableResources(tables, context.ids.tables, operation.tableId);
        await withTimeout("tablesDB.createIndex", () =>
          tables.createIndex({
            databaseId: context.ids.tables,
            tableId: operation.tableId,
            key: operation.spec.key,
            type: operation.spec.type === "unique" ? TablesDBIndexType.Unique : TablesDBIndexType.Key,
            columns: operation.spec.columns,
          }),
        );
        touchedTables.add(operation.tableId);
        break;
      case "ensureSpine":
        await waitForTableResources(tables, context.ids.tables, "sectors");
        await ensureSpine(context);
        break;
      case "ensureFunction":
        await ensureFunction(context, operation.spec, operation.exists);
        break;
      case "deployFunction":
        await deployFunction(context, operation.spec, operation.bundleHash);
        break;
    }
  }
  for (const tableId of touchedTables) {
    await waitForTableResources(tables, context.ids.tables, tableId);
  }
}
