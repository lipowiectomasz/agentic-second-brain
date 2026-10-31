import { scanForSecrets } from "@cortex/core/secrets";
import type { FileEntry, ManifestData, ManifestSector, PushOutcome } from "@cortex/gateway-contract";
import { CliError, exitCodes } from "./errors";
import { moveDirectory, readLocal, removeLocal, writeLocal } from "./files";
import { editedManagedKeys, stripManaged, writeManaged } from "./frontmatter";
import type { GatewayClient } from "./gateway-client";
import { emptyIndexDirs, indexMarker, indexTargets, renderIndex } from "./index-file";
import { localPathFor } from "./layout";
import { scanLocalFiles } from "./local-files";
import type { Output } from "./output";
import type { Change } from "./plan";
import { classify, revokedSectors } from "./plan";
import { runPool } from "./pool";
import { listQuarantine, quarantine } from "./quarantine";
import type { SyncState } from "./state";
import { emptyState, readState, writeState } from "./state";

export interface SyncContext {
  root: string;
  client: GatewayClient;
  out: Output;
  identity: { endpoint: string; projectId: string; userId: string };
  scope: "read" | "write";
}

const poolSize = 4;

function dropFiles(state: SyncState, remove: (key: string) => boolean): void {
  state.files = Object.fromEntries(Object.entries(state.files).filter(([key]) => !remove(key)));
}

function stateEntry(entry: FileEntry) {
  return { fileId: entry.fileId, sectorId: entry.sectorId, version: entry.version, hash: entry.hash, kind: entry.kind, meta: entry.meta };
}

async function loadState(ctx: SyncContext, manifest: ManifestData): Promise<SyncState> {
  return (await readState(ctx.root, ctx.identity)) ?? emptyState({ ...ctx.identity, authorSlug: manifest.authorSlug });
}

function rememberSectors(state: SyncState, manifest: ManifestData): void {
  state.authorSlug = manifest.authorSlug;
  state.sectors = Object.fromEntries(manifest.sectors.map((sector) => [sector.slug, { id: sector.id, kind: sector.kind }]));
}

export async function writeIndexes(ctx: SyncContext, manifest: ManifestData): Promise<void> {
  for (const sector of manifest.sectors) {
    const entries = manifest.files.filter((entry) => entry.sectorId === sector.id);
    const base = sector.kind === "spine" ? "" : `brains/${sector.slug}`;
    for (const target of indexTargets(entries)) {
      const dir = [base, target.dir].filter((part) => part !== "").join("/");
      await writeLocal(ctx.root, dir === "" ? "_INDEX.md" : `${dir}/_INDEX.md`, renderIndex(sector.name, entries, target), 0o444);
    }
    for (const empty of emptyIndexDirs(entries)) {
      const stale = [base, empty, "_INDEX.md"].filter((part) => part !== "").join("/");
      const content = await readLocal(ctx.root, stale).catch(() => null);
      if (content?.startsWith(indexMarker) === true) await removeLocal(ctx.root, stale);
    }
  }
}

async function moveRevoked(ctx: SyncContext, state: SyncState, manifest: ManifestData): Promise<void> {
  for (const slug of revokedSectors(state, manifest)) {
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    await moveDirectory(ctx.root, `brains/${slug}`, `.cortex/revoked/${slug}-${stamp}`);
    dropFiles(state, (key) => key.startsWith(`brains/${slug}/`));
    ctx.out.warn(`access to ${slug} was removed; its files moved to .cortex/revoked/${slug}-${stamp}`);
  }
}

export async function pull(ctx: SyncContext): Promise<{ changed: number }> {
  const manifest = await ctx.client.call("manifest", {});
  const state = await loadState(ctx, manifest);
  await moveRevoked(ctx, state, manifest);
  const changes = classify(await scanLocalFiles(ctx.root), state, manifest);
  let changed = 0;
  const fetches = changes.filter((change) => change.kind === "remoteNew" || change.kind === "remoteModified");
  const results = await runPool(fetches, poolSize, async (change) => {
    const remote = change.remote as FileEntry;
    const file = await ctx.client.call("filesContent", { fileId: remote.fileId });
    await writeLocal(ctx.root, change.path, file.content);
    state.files[change.path] = stateEntry(file);
    return change;
  });
  for (const result of results) {
    if (result.error !== undefined) throw result.error;
    changed += 1;
    ctx.out.line(result.item.kind === "remoteNew" ? "+" : "~", result.item.kind === "remoteNew" ? "pulled" : "updated", "success", result.item.path);
  }
  for (const change of changes) {
    if (change.kind === "remoteDeleted") {
      await removeLocal(ctx.root, change.path);
      dropFiles(state, (key) => key === change.path);
      changed += 1;
      ctx.out.line("-", "removed", "muted", change.path);
    } else if (change.kind === "unchanged" && change.remote !== null) {
      const saved = state.files[change.path];
      if (saved === undefined || JSON.stringify(saved.meta) !== JSON.stringify(change.remote.meta) || saved.version !== change.remote.version) {
        const local = await readLocal(ctx.root, change.path);
        if (await writeLocal(ctx.root, change.path, writeManaged(local, change.remote.meta))) changed += 1;
      }
      state.files[change.path] = stateEntry(change.remote);
    } else if (change.kind === "bothModified" || change.kind === "immutable" || change.kind === "readOnly") {
      ctx.out.line("=", "kept", "muted", `${change.path} (local edit kept)`);
    }
  }
  const known = new Set(changes.map((change) => change.path));
  dropFiles(state, (key) => !known.has(key));
  rememberSectors(state, manifest);
  await writeIndexes(ctx, manifest);
  await writeState(ctx.root, state);
  return { changed };
}

export interface PushOptions {
  strict: boolean;
  delete: boolean;
}

function supersedeHint(change: Change): string {
  const kind = change.remote?.kind === "finding" ? "finding" : change.remote?.kind === "backlog" ? "backlog" : "spec";
  const id = change.remote?.meta.docId ?? "this document";
  return `${change.path} is ${id}, approved and read-only. Create a correction: cortex reserve ${kind} --create <slug>, then add "supersedes: ${id}".`;
}

async function applyOutcome(ctx: SyncContext, state: SyncState, change: Change, outcome: PushOutcome, localText: string): Promise<"ok" | "rejected" | "quarantined"> {
  if (outcome.result === "rejected") {
    if (outcome.reason === "secret_detected") {
      await quarantine(ctx.root, change.path);
      state.quarantine.push({ path: change.path, line: outcome.line ?? 0, kind: outcome.secretKind ?? "secret", at: new Date().toISOString() });
      ctx.out.line("!", "quarantined", "warning", `${change.path}: secret detected (line ${outcome.line ?? "?"}), not stored - remove the secret and push again`);
      return "quarantined";
    }
    const messages: Record<string, string> = {
      immutable: supersedeHint(change),
      not_author: `${change.path}: only the author can change a draft`,
      forbidden: `${change.path}: your role does not allow writing to this sector`,
      too_large: `${change.path}: larger than 256 KiB`,
      invalid_path: `${change.path}: the path is not allowed`,
    };
    ctx.out.line("✕", "rejected", "danger", messages[outcome.reason] ?? change.path);
    return "rejected";
  }
  const content = outcome.result === "merged" || outcome.result === "overwritten" ? outcome.content : localText;
  await writeLocal(ctx.root, change.path, writeManaged(content, outcome.file.meta));
  state.files[change.path] = stateEntry(outcome.file);
  const words: Record<string, [string, string, "success" | "muted"]> = { created: ["+", "created", "success"], updated: ["~", "updated", "success"], unchanged: ["=", "unchanged", "muted"], merged: ["~", "merged", "success"], overwritten: ["~", "updated", "success"] };
  const [glyph, word, tone] = words[outcome.result] ?? ["~", outcome.result, "success"];
  const extra = outcome.result === "overwritten" ? ` v${outcome.file.version} (previous kept as v${outcome.overwrittenVersion})` : ` v${outcome.file.version}`;
  ctx.out.line(glyph, word, tone, `${change.path}${extra}`);
  return "ok";
}

export async function push(ctx: SyncContext, options: PushOptions): Promise<number> {
  if (ctx.scope !== "write") {
    if (ctx.out.quiet) {
      ctx.out.warn("this token can only read; push skipped");
      return exitCodes.ok;
    }
    throw new CliError("This token can only read. Create a read and write token in the web app.", exitCodes.scope);
  }
  if (options.delete && ctx.out.quiet) throw new CliError("--delete is not allowed with --quiet.", exitCodes.usage);
  const manifest = await ctx.client.call("manifest", {});
  const state = await loadState(ctx, manifest);
  const changes = classify(await scanLocalFiles(ctx.root), state, manifest);
  let rejected = 0;
  let quarantined = 0;
  const batch: Array<{ change: Change; text: string; stripped: ReturnType<typeof stripManaged> }> = [];
  for (const change of changes) {
    if (change.kind === "immutable") {
      ctx.out.line("✕", "immutable", "warning", supersedeHint(change));
      continue;
    }
    if (change.kind === "readOnly") ctx.out.line("=", "read-only", "muted", change.path);
    if (change.kind === "tooLarge") ctx.out.line("✕", "too large", "warning", `${change.path}: larger than 256 KiB, not sent`);
    if (change.kind === "unknownSector") ctx.out.line("✕", "skipped", "warning", `${change.path}: not in a sector you can reach`);
    if (change.kind !== "localNew" && change.kind !== "localModified" && change.kind !== "bothModified") continue;
    const text = await readLocal(ctx.root, change.path);
    const stripped = stripManaged(text);
    const findings = scanForSecrets(stripped.text);
    if (findings.length > 0) {
      await quarantine(ctx.root, change.path);
      state.quarantine.push({ path: change.path, line: findings[0]?.line ?? 0, kind: findings[0]?.ruleId ?? "secret", at: new Date().toISOString() });
      ctx.out.line("!", "quarantined", "warning", `${change.path}: secret detected (line ${findings[0]?.line ?? "?"}), not stored - remove the secret and push again`);
      quarantined += 1;
      continue;
    }
    batch.push({ change, text, stripped });
  }
  const results = await runPool(batch, poolSize, async ({ change, stripped }) => {
    const sector = change.sector as ManifestSector;
    return ctx.client.call("filesPush", {
      sectorId: sector.id,
      path: change.sectorPath as string,
      content: stripped.text,
      baseVersion: change.kind === "localNew" ? null : change.baseVersion,
      baseHash: change.kind === "localNew" ? null : change.baseHash,
      declared: change.kind === "localNew" ? stripped.declared : { supersedes: null, relatesTo: null },
    });
  });
  for (const result of results) {
    if (result.error !== undefined) {
      if (result.error instanceof CliError && result.error.exitCode !== exitCodes.unexpected) throw result.error;
      ctx.out.line("✕", "failed", "danger", `${result.item.change.path}: ${result.error instanceof Error ? result.error.message : "unknown error"}`);
      rejected += 1;
      continue;
    }
    const applied = await applyOutcome(ctx, state, result.item.change, result.result as PushOutcome, result.item.stripped.text);
    if (applied === "rejected") rejected += 1;
    if (applied === "quarantined") quarantined += 1;
  }
  if (options.delete) {
    for (const change of changes.filter((entry) => entry.kind === "localDeleted")) {
      const sector = change.sector as ManifestSector;
      const outcome = await ctx.client.call("filesDelete", { sectorId: sector.id, path: change.sectorPath as string, baseVersion: change.baseVersion ?? 1 });
      if (outcome.result === "deleted" || outcome.result === "not_found") {
        dropFiles(state, (key) => key === change.path);
        ctx.out.line("-", "deleted", "muted", change.path);
      } else {
        rejected += 1;
        ctx.out.line("✕", "rejected", "danger", `${change.path}: ${outcome.result === "rejected" ? outcome.reason : "changed on the server, kept"}`);
      }
    }
  } else {
    for (const change of changes.filter((entry) => entry.kind === "localDeleted")) ctx.out.line("=", "kept", "muted", `${change.path}: deleted locally; push --delete removes it on the server`);
  }
  rememberSectors(state, manifest);
  await writeState(ctx.root, state);
  await writeIndexes(ctx, await ctx.client.call("manifest", {}));
  if (options.strict && quarantined > 0) return exitCodes.secret;
  if (options.strict && rejected > 0) return exitCodes.rejected;
  return exitCodes.ok;
}

export async function report(ctx: SyncContext): Promise<Change[]> {
  const manifest = await ctx.client.call("manifest", {});
  const state = await readState(ctx.root, ctx.identity);
  const changes = classify(await scanLocalFiles(ctx.root), state, manifest);
  const visible = changes.filter((change) => change.kind !== "unchanged");
  const labels: Record<string, [string, string, "success" | "muted" | "warning" | "danger" | "info"]> = {
    localNew: ["+", "new", "success"],
    localModified: ["~", "modified", "success"],
    localDeleted: ["-", "deleted", "muted"],
    remoteNew: ["+", "remote new", "info"],
    remoteModified: ["~", "remote", "info"],
    remoteDeleted: ["-", "remote gone", "info"],
    bothModified: ["~", "both", "warning"],
    immutable: ["✕", "immutable", "warning"],
    readOnly: ["=", "read-only", "muted"],
    tooLarge: ["✕", "too large", "warning"],
    unknownSector: ["✕", "no sector", "warning"],
    quarantined: ["!", "quarantined", "warning"],
  };
  for (const change of visible) {
    const [glyph, word, tone] = labels[change.kind] ?? ["?", change.kind, "muted"];
    ctx.out.line(glyph, word, tone, change.path);
  }
  for (const path of await listQuarantine(ctx.root)) ctx.out.line("!", "quarantined", "warning", `${path} (in .cortex/quarantine)`);
  for (const change of changes.filter((entry) => entry.kind === "unchanged" && entry.remote?.meta.docId !== null && entry.remote !== null)) {
    const edited = editedManagedKeys(await readLocal(ctx.root, change.path), (change.remote as FileEntry).meta);
    if (edited.length > 0) ctx.out.warn(`${change.path}: ${edited.join(", ")} is managed by the server; your edit has no effect`);
  }
  if (visible.length === 0) ctx.out.info("Everything is in sync.");
  ctx.out.data(visible.map((change) => ({ path: change.path, kind: change.kind })));
  return changes;
}

export { localPathFor };
