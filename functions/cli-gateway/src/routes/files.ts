import type { PushOutcome } from "@cortex/gateway-contract";
import { routes } from "@cortex/gateway-contract";
import { KnowledgeError, KnowledgeStore, deleteFile, ingestFile, readFile } from "@cortex/knowledge";
import type { GatewayContext } from "../context";
import { route } from "../router";
import { readDeps, writeDeps } from "./deps";
import { entryFromRow } from "./file-entry";

type PushInput = { sectorId: string; path: string; content: string; baseVersion: number | null; baseHash: string | null; declared: { supersedes: string | null; relatesTo: string | null } };

function rejected(reason: Extract<PushOutcome, { result: "rejected" }>["reason"], extra: { docId?: string | null; line?: number | null; secretKind?: string | null } = {}): PushOutcome {
  return { result: "rejected", reason, docId: extra.docId ?? null, line: extra.line ?? null, secretKind: extra.secretKind ?? null };
}

export function rejectionFor(error: unknown): PushOutcome | null {
  if (!(error instanceof KnowledgeError)) return null;
  const details = error.details;
  switch (details.code) {
    case "immutable":
      return rejected("immutable", { docId: details.docId });
    case "not_author":
      return rejected("not_author");
    case "forbidden":
      return rejected("forbidden");
    case "secret_detected":
      return rejected("secret_detected", { line: details.findings[0]?.line ?? null, secretKind: details.findings[0]?.ruleId ?? null });
    case "too_large":
    case "too_many_chunks":
      return rejected("too_large");
    case "invalid_input":
      return details.issues.some((issue) => issue.startsWith("path") || issue.includes("path")) ? rejected("invalid_path") : null;
    default:
      return null;
  }
}

export async function pushFile(ctx: GatewayContext, input: PushInput): Promise<PushOutcome> {
  const deps = writeDeps(ctx);
  try {
    const result = await ingestFile(deps, ctx.caller, {
      sectorId: input.sectorId,
      path: input.path,
      content: input.content,
      baseVersion: input.baseVersion,
      baseHash: input.baseHash,
      declared: { ...(input.declared.supersedes === null ? {} : { supersedes: input.declared.supersedes }), ...(input.declared.relatesTo === null ? {} : { relatesTo: input.declared.relatesTo }) },
    });
    const row = await new KnowledgeStore(deps.admin, deps.ids).fileByPath(input.sectorId, input.path);
    if (row === null) throw new KnowledgeError({ code: "storage_failed" });
    const file = entryFromRow(row);
    if (result.status === "merged") return { result: "merged", file, content: result.content ?? row.content };
    if (result.status === "overwritten") return { result: "overwritten", file, content: result.content ?? row.content, overwrittenVersion: result.overwrittenVersion ?? file.version };
    return { result: result.status, file };
  } catch (error) {
    const outcome = rejectionFor(error);
    if (outcome !== null) return outcome;
    throw error;
  }
}

export const filesPushRoute = route(routes.filesPush, pushFile);

export const filesContentRoute = route(routes.filesContent, async (ctx, input) => {
  const view = await readFile(readDeps(ctx), { fileId: input.fileId });
  const row = await new KnowledgeStore(ctx.adminClient, ctx.ids).fileByPath(view.sectorId, view.path);
  if (row === null) throw new KnowledgeError({ code: "not_found" });
  return { ...entryFromRow(row), content: view.content };
});

export const filesDeleteRoute = route(routes.filesDelete, async (ctx, input) => {
  try {
    const result = await deleteFile(writeDeps(ctx), ctx.caller, input);
    if (result.status === "kept_changed") return { result: "kept_changed" as const, currentVersion: result.currentVersion };
    return { result: result.status };
  } catch (error) {
    if (error instanceof KnowledgeError && (error.code === "immutable" || error.code === "not_author" || error.code === "forbidden")) return { result: "rejected" as const, reason: error.code };
    throw error;
  }
});
