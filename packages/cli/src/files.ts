import { chmod, mkdir, readFile, rename, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { safeResolve } from "./layout";

export async function readLocal(root: string, localPath: string): Promise<string> {
  return readFile(safeResolve(root, localPath), "utf8");
}

export async function writeLocal(root: string, localPath: string, content: string, mode = 0o644): Promise<boolean> {
  const target = safeResolve(root, localPath);
  try {
    if ((await readFile(target, "utf8")) === content) return false;
    await chmod(target, 0o644);
  } catch {
    await mkdir(path.dirname(target), { recursive: true });
  }
  const temp = `${target}.cortex-tmp`;
  await writeFile(temp, content, { mode: 0o644 });
  await rename(temp, target);
  if (mode !== 0o644) await chmod(target, mode);
  return true;
}

export async function removeLocal(root: string, localPath: string): Promise<void> {
  await unlink(safeResolve(root, localPath)).catch(() => undefined);
}

export async function moveDirectory(root: string, from: string, to: string): Promise<void> {
  const target = safeResolve(root, to);
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await rename(safeResolve(root, from), target).catch(async () => {
    await rm(target, { recursive: true, force: true });
  });
}
