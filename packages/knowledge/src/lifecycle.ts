import type { DocumentStatus, FileKind, SectorKind, SectorRole } from "@cortex/core";
import { kindClass } from "@cortex/core";
import type { Caller } from "@cortex/server-kit";
import type { KnowledgeErrorDetails } from "./types";

export type WriteAction = "create" | "update" | "delete";

export interface WriteContext {
  caller: Caller;
  isAdmin: boolean;
  sectorRole: SectorRole | null;
  sectorKind: SectorKind;
  authorSlug: string;
}

export interface ExistingDoc {
  authorId: string;
  status: DocumentStatus | null;
}

type Decision = { allowed: true } | { allowed: false; error: KnowledgeErrorDetails };

const allowed: Decision = { allowed: true };
const refuse = (error: KnowledgeErrorDetails): Decision => ({ allowed: false, error });

export function authorSlugOf(caller: Pick<Caller, "email">): string {
  const local = caller.email.split("@")[0] ?? "";
  return local
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function decideWrite(kind: FileKind, path: string, action: WriteAction, ctx: WriteContext, existing: ExistingDoc | null): Decision {
  if (ctx.caller.channel === "token" && ctx.caller.tokenScope !== "write") return refuse({ code: "forbidden", reason: "token_scope" });
  const kindsClass = kindClass[kind];
  if (kindsClass === "spine") return ctx.isAdmin ? allowed : refuse({ code: "forbidden", reason: "spine_requires_proposal" });
  if (kindsClass === "personal") {
    const owner = path.split("/")[1];
    const ownsPath = owner === ctx.authorSlug;
    const ownsRow = action === "create" || existing === null || existing.authorId === ctx.caller.userId;
    const member = ctx.isAdmin || ctx.sectorRole !== null;
    return ownsPath && ownsRow && member ? allowed : refuse({ code: "forbidden", reason: "memory_owner" });
  }
  if (!ctx.isAdmin && ctx.sectorRole !== "maintainer") return refuse({ code: "forbidden", reason: "role" });
  if (kindsClass === "immutable" && action !== "create" && existing !== null) {
    if (existing.status !== "draft" && !ctx.isAdmin) return refuse({ code: "immutable", docId: null, status: existing.status });
    if (existing.status === "draft" && existing.authorId !== ctx.caller.userId && !ctx.isAdmin) return refuse({ code: "not_author" });
  }
  if (kindsClass === "write-once" && action !== "create" && existing !== null) {
    if (!(action === "delete" && ctx.isAdmin)) return refuse({ code: "immutable", docId: null, status: existing.status });
  }
  return allowed;
}

export const statusTransitions: Readonly<Record<DocumentStatus, readonly DocumentStatus[]>> = {
  draft: ["approved", "deprecated"],
  approved: ["in_progress", "deprecated"],
  in_progress: ["implemented", "deprecated"],
  implemented: ["deprecated"],
  superseded: [],
  deprecated: [],
};

export function decideTransition(kind: FileKind, from: DocumentStatus | null, to: DocumentStatus): Decision {
  const transitionable = kind === "spec" || kind === "backlog";
  if (!transitionable || from === null || to === "superseded" || !statusTransitions[from].includes(to)) {
    return refuse({ code: "invalid_transition", from, to });
  }
  return allowed;
}
