import { describe, expect, it } from "vitest";
import { databaseIds, loadServerEnv } from "@cortex/config";
import { createAdminClient } from "@cortex/server-kit";
import { readCurrentState } from "../src/current-state";
import { planChanges } from "../src/plan";
import { schemaFor } from "../src/schema";
import { runSetup } from "../src/commands/setup";

const env = loadServerEnv(process.env);
const namespace = env.CORTEX_TEST_DATABASE_NAMESPACE;

describe("schema provisioning", () => {
  it("plans nothing on a namespace provisioned by the global reset", async () => {
    const lines: string[] = [];
    expect(await runSetup(namespace, (line) => lines.push(line))).toBe(0);
    expect(lines).toContain(`Namespace ${namespace}: 0 changes`);
  });

  it("reads back every declared table, column and index", async () => {
    const schema = schemaFor(namespace, env.CORTEX_FUNCTION_API_ENDPOINT === undefined ? {} : { functionApiEndpoint: env.CORTEX_FUNCTION_API_ENDPOINT });
    const state = await readCurrentState(createAdminClient(env), databaseIds(namespace), schema);
    expect(state.spine).toBe(true);
    expect(state.collections.chunks?.dimension).toBe(768);
    expect(state.collections.chunks?.indexes.embeddings_cosine).toBe("hnsw_cosine");
    for (const table of schema.tables) {
      expect(Object.keys(state.tables[table.id]?.columns ?? {}).sort()).toEqual(table.columns.map((column) => column.key).sort());
      expect(Object.keys(state.tables[table.id]?.indexes ?? {}).sort()).toEqual(table.indexes.map((index) => index.key).sort());
    }
    expect(planChanges(schema, state, {}).drift).toEqual([]);
  });
});
