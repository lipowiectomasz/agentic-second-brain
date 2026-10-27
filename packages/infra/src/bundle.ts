import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { build } from "esbuild";
import type { FunctionSpec } from "./schema/types";

const run = promisify(execFile);

export interface FunctionBundle {
  archivePath: string;
  hash: string;
}

export async function bundleFunction(spec: FunctionSpec, repositoryRoot: string, outDir: string): Promise<FunctionBundle> {
  const workDir = path.join(outDir, spec.id);
  const sourceDir = path.join(workDir, "src");
  await rm(workDir, { recursive: true, force: true });
  await mkdir(sourceDir, { recursive: true });
  await build({
    entryPoints: [path.join(repositoryRoot, spec.entry)],
    outfile: path.join(sourceDir, "main.mjs"),
    bundle: true,
    platform: "node",
    target: "node22",
    format: "esm",
    legalComments: "none",
    logLevel: "silent",
    banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
  });
  await writeFile(path.join(sourceDir, "package.json"), `${JSON.stringify({ name: spec.id, type: "module" })}\n`);
  const code = await readFile(path.join(sourceDir, "main.mjs"));
  const hash = createHash("sha256").update(code).digest("hex");
  const archivePath = path.join(outDir, `${spec.id}.tar.gz`);
  await run("tar", ["--sort=name", "--mtime=@0", "--owner=0", "--group=0", "--numeric-owner", "-czf", archivePath, "-C", sourceDir, "."]);
  return { archivePath, hash };
}
