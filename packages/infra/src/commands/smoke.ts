import { loadServerEnv } from "@cortex/config";
import { smokeChecks } from "../smoke";

export async function runSmoke(log: (line: string) => void): Promise<number> {
  const env = loadServerEnv(process.env);
  if (env.CORTEX_SITE_URL === undefined) {
    log("missing CORTEX_SITE_URL");
    return 2;
  }
  const results = await smokeChecks(env.CORTEX_SITE_URL, env.APPWRITE_ENDPOINT, (url, init) => fetch(url, init));
  for (const result of results) log(`${result.ok ? "ok  " : "FAIL"} ${result.name} (${result.detail})`);
  return results.every((result) => result.ok) ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSmoke((line) => process.stdout.write(`${line}\n`))
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    });
}
