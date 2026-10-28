import path from "node:path";
import type { ProposalKind } from "./types";

const pattern = /^(standards|procedures)\/[a-z0-9][a-z0-9/_-]{0,200}\.md$/;

export function validateTarget(input: { kind: ProposalKind; targetPath: string }): { ok: true; path: string } | { ok: false; reason: "unsafe_path" | "wrong_root" | "kind_mismatch" } {
  const raw = input.targetPath.trim();
  if (raw.includes("..") || raw.startsWith("/") || raw.includes("\\") || raw.includes("//")) return { ok: false, reason: "unsafe_path" };
  const normalized = path.posix.normalize(raw);
  if (normalized !== raw || !pattern.test(normalized)) return { ok: false, reason: normalized.startsWith("standards/") || normalized.startsWith("procedures/") ? "unsafe_path" : "wrong_root" };
  const root = normalized.split("/")[0];
  if ((root === "standards") !== (input.kind === "standard")) return { ok: false, reason: "kind_mismatch" };
  return { ok: true, path: normalized };
}
