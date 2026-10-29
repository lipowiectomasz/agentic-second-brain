import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

export const siteArchiveRoots = ["package.json", "package-lock.json", "tsconfig.base.json", "apps", "packages", "functions"] as const;

const skippedDirectories = new Set(["node_modules", ".next", "dist", "coverage", "tests", "test", ".turbo"]);

export class SiteDeployError extends Error {
  constructor(readonly code: "env_file_in_archive" | "build_failed" | "build_timeout" | "domain_taken" | "warm_up_failed" | "missing_env", detail: string) {
    super(`${code}: ${detail}`);
    this.name = "SiteDeployError";
  }
}

export function isEnvFile(relativePath: string): boolean {
  return /(^|\/)\.env(\.|$)/.test(relativePath) && !relativePath.endsWith(".env.example");
}

export function shouldPack(relativePath: string): boolean {
  const segments = relativePath.split("/");
  if (segments.slice(0, -1).some((segment) => skippedDirectories.has(segment))) return false;
  const name = segments.at(-1) ?? "";
  return !/\.test\.tsx?$/.test(name) && !name.endsWith(".tsbuildinfo");
}

async function walk(root: string, relative: string): Promise<string[]> {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const child = relative === "" ? entry.name : `${relative}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!skippedDirectories.has(entry.name)) files.push(...(await walk(root, child)));
    } else if (entry.isFile()) {
      files.push(child);
    }
  }
  return files;
}

export async function listSiteFiles(repositoryRoot: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(repositoryRoot, { withFileTypes: true });
  for (const root of siteArchiveRoots) {
    const entry = entries.find((candidate) => candidate.name === root);
    if (entry === undefined) continue;
    if (entry.isDirectory()) files.push(...(await walk(repositoryRoot, root)));
    else files.push(root);
  }
  const packed = files.filter(shouldPack).sort();
  const envFile = packed.find(isEnvFile);
  if (envFile !== undefined) throw new SiteDeployError("env_file_in_archive", envFile);
  return packed;
}

export async function packSite(repositoryRoot: string, outDir: string): Promise<{ archivePath: string; hash: string; files: string[] }> {
  const files = await listSiteFiles(repositoryRoot);
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(`${file}\n`);
    hash.update(await readFile(path.join(repositoryRoot, file)));
  }
  const listPath = path.join(outDir, "site-files.txt");
  await writeFile(listPath, `${files.join("\n")}\n`);
  const archivePath = path.join(outDir, "site.tar.gz");
  await run("tar", ["--sort=name", "--mtime=@0", "--owner=0", "--group=0", "--numeric-owner", "-czf", archivePath, "-C", repositoryRoot, "-T", listPath]);
  return { archivePath, hash: hash.digest("hex"), files };
}
