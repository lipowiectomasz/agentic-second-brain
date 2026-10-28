import { mkdir, open, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { CliError, exitCodes } from "./errors";
import { cortexDir } from "./state";

const staleMs = 10 * 60 * 1000;

export async function withLock<T>(root: string, warn: (line: string) => void, task: () => Promise<T>): Promise<T> {
  await mkdir(path.join(root, cortexDir), { recursive: true, mode: 0o700 });
  const file = path.join(root, cortexDir, "lock");
  let handle;
  try {
    handle = await open(file, "wx", 0o600);
  } catch {
    const age = Date.now() - (await stat(file)).mtimeMs;
    if (age < staleMs) throw new CliError("Another cortex command is running in this directory.", exitCodes.unexpected);
    warn("taking over a lock older than 10 minutes");
    await unlink(file);
    handle = await open(file, "wx", 0o600);
  }
  await handle.writeFile(String(process.pid));
  await handle.close();
  try {
    return await task();
  } finally {
    await unlink(file).catch(() => undefined);
  }
}
