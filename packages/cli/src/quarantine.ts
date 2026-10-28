import { chmod, mkdir, readdir, rename } from "node:fs/promises";
import path from "node:path";
import { safeResolve } from "./layout";
import { cortexDir } from "./state";

export const quarantineDir = `${cortexDir}/quarantine`;

export async function quarantine(root: string, localPath: string): Promise<string> {
  const target = safeResolve(root, `${quarantineDir}/${localPath}`);
  await mkdir(path.join(root, quarantineDir), { recursive: true, mode: 0o700 });
  await chmod(path.join(root, quarantineDir), 0o700);
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await rename(safeResolve(root, localPath), target);
  return target;
}

export async function listQuarantine(root: string): Promise<string[]> {
  const found: string[] = [];
  async function walk(relative: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(path.join(root, quarantineDir, relative), { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const child = relative === "" ? entry.name : `${relative}/${entry.name}`;
      if (entry.isDirectory()) await walk(child);
      else if (entry.isFile()) found.push(child);
    }
  }
  await walk("");
  return found.sort();
}
