import { beforeAll, describe, expect, it } from "vitest";
import { databaseIds, loadServerEnv } from "@cortex/config";
import { createAdminClient } from "@cortex/server-kit";
import { readCurrentState } from "../src/current-state";
import { planChanges } from "../src/plan";
import { schema } from "../src/schema";
import { runSetup } from "../src/commands/setup";
import { runTestReset } from "../src/commands/test-reset";

const env = loadServerEnv(process.env);
const namespace = env.CORTEX_TEST_DATABASE_NAMESPACE;
const silent = () => undefined;

describe("schema provisioning", () => {
  beforeAll(async () => {
    expect(await runTestReset(silent)).toBe(0);
  });

  it("converges from an empty namespace and plans nothing on the second run", async () => {
    const lines: string[] = [];
    expect(await runSetup(namespace, (line) => lines.push(line))).toBe(0);
    expect(lines).toContain(`Namespace ${namespace}: 0 changes`);
  });

  it("reads back every declared table, column and index", async () => {
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
