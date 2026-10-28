import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { databaseIds, loadServerEnv } from "@cortex/config";
import { createAdminClient } from "@cortex/server-kit";
import { applyOperations } from "../apply";
import { bundleFunction } from "../bundle";
import { readCurrentState } from "../current-state";
import { planChanges } from "../plan";
import { describeOperation } from "../plan";
import { repositoryRoot } from "../repository-paths";
import { schemaFor } from "../schema";

export async function runSetup(namespace: string, log: (line: string) => void): Promise<number> {
  const env = loadServerEnv(process.env);
  const client = createAdminClient(env);
  const ids = databaseIds(namespace);
  const schema = schemaFor(namespace, env.CORTEX_FUNCTION_API_ENDPOINT === undefined ? {} : { functionApiEndpoint: env.CORTEX_FUNCTION_API_ENDPOINT });
  const outDir = await mkdtemp(path.join(tmpdir(), "cortex-bundles-"));
  try {
    const bundles: Record<string, string> = {};
    const archives: Record<string, string> = {};
    for (const fn of schema.functions) {
      const bundle = await bundleFunction(fn, repositoryRoot, outDir);
      bundles[fn.id] = bundle.hash;
      archives[fn.id] = bundle.archivePath;
    }

    const before = planChanges(schema, await readCurrentState(client, ids, schema), bundles);
    if (before.drift.length > 0) {
      log("Schema drift detected, nothing was changed:");
      for (const drift of before.drift) log(`  ${drift.resource}: expected ${drift.expected}, found ${drift.actual}`);
      return 1;
    }
    log(`Namespace ${namespace}: ${before.operations.length} changes`);
    await applyOperations({ client, ids, bundles, archives, log }, before.operations);

    const after = planChanges(schema, await readCurrentState(client, ids, schema), bundles);
    if (after.operations.length > 0 || after.drift.length > 0) {
      log("Schema did not converge:");
      for (const operation of after.operations) log(`  pending: ${describeOperation(operation)}`);
      for (const drift of after.drift) log(`  drift: ${drift.resource}`);
      return 1;
    }
    log("Schema converged");
    return 0;
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const env = loadServerEnv(process.env);
  runSetup(env.CORTEX_DATABASE_NAMESPACE, (line) => process.stdout.write(`${line}\n`))
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    });
}
