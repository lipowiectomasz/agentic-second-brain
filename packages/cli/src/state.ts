import { mkdir, open, readFile, rename } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { documentMetaSchema, fileKindSchema } from "@cortex/gateway-contract";
import { CliError, exitCodes } from "./errors";

export const stateFileSchema = z.object({
  fileId: z.string(),
  sectorId: z.string(),
  version: z.number().int().min(1),
  hash: z.string().regex(/^[0-9a-f]{64}$/),
  kind: fileKindSchema,
  meta: documentMetaSchema,
});

export const stateSchema = z.object({
  schema: z.literal(2),
  endpoint: z.string(),
  projectId: z.string(),
  userId: z.string(),
  authorSlug: z.string(),
  sectors: z.record(z.string(), z.object({ id: z.string(), kind: z.enum(["spine", "project"]) })),
  files: z.record(z.string(), stateFileSchema),
  quarantine: z.array(z.object({ path: z.string(), line: z.number().int(), kind: z.string(), at: z.string() })),
});

export type SyncState = z.infer<typeof stateSchema>;
export type StateFile = z.infer<typeof stateFileSchema>;

export const cortexDir = ".cortex";

export function emptyState(identity: { endpoint: string; projectId: string; userId: string; authorSlug: string }): SyncState {
  return { schema: 2, ...identity, sectors: {}, files: {}, quarantine: [] };
}

export async function readState(root: string, identity: { endpoint: string; projectId: string; userId: string }): Promise<SyncState | null> {
  let raw: string;
  try {
    raw = await readFile(path.join(root, cortexDir, "state.json"), "utf8");
  } catch {
    return null;
  }
  const parsed = stateSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) throw new CliError("The sync state is damaged. Delete .cortex/state.json and pull again.", exitCodes.unexpected);
  const state = parsed.data;
  if (state.endpoint !== identity.endpoint || state.projectId !== identity.projectId || state.userId !== identity.userId) {
    throw new CliError("This directory is synced for another account or server. Use a new directory.", exitCodes.usage);
  }
  return state;
}

export async function writeState(root: string, state: SyncState): Promise<void> {
  const dir = path.join(root, cortexDir);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const target = path.join(dir, "state.json");
  const temp = `${target}.tmp`;
  const handle = await open(temp, "w", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(state, null, 2)}\n`);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temp, target);
}
