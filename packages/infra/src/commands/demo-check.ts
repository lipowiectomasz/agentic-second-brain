import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseDenylist, scanCorpus } from "../demo/leak-scan";
import { loadDemoManifest } from "../demo/manifest";
import { repositoryRoot } from "../repository-paths";

export async function runDemoCheck(log: (line: string) => void): Promise<number> {
  const denylistFile = path.join(repositoryRoot, ".demo-denylist");
  const denylist = await readFile(denylistFile, "utf8").then(parseDenylist, () => null);
  if (denylist === null || denylist.length === 0) {
    log("missing .demo-denylist: list the client, person and host names that must never appear in the demo, one per line");
    return 2;
  }
  const corpusRoot = path.join(repositoryRoot, "demo/corpus");
  await loadDemoManifest(path.join(repositoryRoot, "demo/seed.json"), corpusRoot);
  const files = new Map<string, string>();
  for (const sector of await readdir(corpusRoot)) {
    for (const name of await readdir(path.join(corpusRoot, sector))) files.set(`${sector}/${name}`, await readFile(path.join(corpusRoot, sector, name), "utf8"));
  }
  files.set("README.md", await readFile(path.join(repositoryRoot, "README.md"), "utf8"));
  const findings = scanCorpus(files, denylist);
  for (const finding of findings) log(`${finding.file}:${finding.line} ${finding.reason}`);
  log(findings.length === 0 ? `demo corpus clean: ${files.size} files, ${denylist.length} denylisted terms` : `${findings.length} findings`);
  return findings.length === 0 ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runDemoCheck((line) => process.stdout.write(`${line}\n`))
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    });
}
