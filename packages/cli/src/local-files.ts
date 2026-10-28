import { lstat, opendir, readFile } from "node:fs/promises";
import path from "node:path";
import { bodyHash } from "./frontmatter";

export const maxFileBytes = 262144;
const skippedDirectories = new Set([".cortex", ".git", "node_modules", ".claude"]);

export interface LocalFile {
  path: string;
  bodyHash: string;
  size: number;
  tooLarge: boolean;
}

async function walk(root: string, relative: string, found: LocalFile[]): Promise<void> {
  const directory = await opendir(path.join(root, relative));
  for await (const entry of directory) {
    const child = relative === "" ? entry.name : `${relative}/${entry.name}`;
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (!skippedDirectories.has(entry.name)) await walk(root, child, found);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".md") || entry.name === "_INDEX.md") continue;
    const absolute = path.join(root, child);
    const info = await lstat(absolute);
    if (info.size > maxFileBytes) {
      found.push({ path: child, bodyHash: "", size: info.size, tooLarge: true });
      continue;
    }
    found.push({ path: child, bodyHash: bodyHash(await readFile(absolute, "utf8")), size: info.size, tooLarge: false });
  }
}

export async function scanLocalFiles(root: string): Promise<LocalFile[]> {
  const found: LocalFile[] = [];
  await walk(root, "", found);
  return found.sort((a, b) => a.path.localeCompare(b.path));
}
