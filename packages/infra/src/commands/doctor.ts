import { Embeddings, Functions } from "node-appwrite";
import { loadServerEnv } from "@cortex/config";
import { createAdminClient, serverEndpoint, withTimeout } from "@cortex/server-kit";

const expectedDimension = 768;

export interface DoctorReport {
  version: string;
  embeddingDimension: number;
  embeddingMs: number;
  healthStatus: number;
}

export async function runDoctor(): Promise<DoctorReport> {
  const env = loadServerEnv(process.env);
  const client = createAdminClient(env);

  const versionResponse = await withTimeout("health version", () =>
    fetch(`${serverEndpoint(env)}/health/version`, { signal: AbortSignal.timeout(10_000) }),
  );
  const { version } = (await versionResponse.json()) as { version: string };

  const started = Date.now();
  const embeddings = await withTimeout(
    "embeddings.createTextEmbeddings",
    () => new Embeddings(client).createTextEmbeddings({ texts: ["cortex doctor"] }),
    120_000,
  );
  const embeddingMs = Date.now() - started;
  const first = embeddings.embeddings[0];
  if (first === undefined || first.error !== "") {
    throw new Error(`Embedding failed: ${first?.error ?? "no result"}`);
  }
  if (first.dimension !== expectedDimension || first.embedding.length !== expectedDimension) {
    throw new Error(`Embedding dimension ${first.dimension}, expected ${expectedDimension}`);
  }

  const execution = await withTimeout("functions.createExecution", () =>
    new Functions(client).createExecution({ functionId: "health", async: false }),
  60_000);
  if (execution.responseStatusCode !== 200) {
    throw new Error(`health function answered ${execution.responseStatusCode}`);
  }

  return { version, embeddingDimension: first.dimension, embeddingMs, healthStatus: execution.responseStatusCode };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runDoctor()
    .then((report) => {
      process.stdout.write(`appwrite ${report.version}\n`);
      process.stdout.write(`embedding dimension ${report.embeddingDimension} (${report.embeddingMs} ms)\n`);
      process.stdout.write(`health ${report.healthStatus}\n`);
    })
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    });
}
