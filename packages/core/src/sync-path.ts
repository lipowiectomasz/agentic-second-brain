export type SyncPathProblem = "absolute" | "traversal" | "extension" | "reserved" | "characters" | "length";

const segmentPattern = /^[A-Za-z0-9._-]+$/;

export function validateSyncPath(path: string, sectorKind: "spine" | "project"): { ok: true } | { ok: false; reason: SyncPathProblem } {
  if (path.length < 4 || path.length > 512) return { ok: false, reason: "length" };
  if (path.startsWith("/") || /^[A-Za-z]:/.test(path)) return { ok: false, reason: "absolute" };
  if (path.includes("\\") || path.includes("\u0000")) return { ok: false, reason: "characters" };
  const segments = path.split("/");
  if (segments.some((segment) => segment === ".." || segment === ".")) return { ok: false, reason: "traversal" };
  if (!segments.every((segment) => segmentPattern.test(segment))) return { ok: false, reason: "characters" };
  if (!path.endsWith(".md")) return { ok: false, reason: "extension" };
  if (segments.at(-1) === "_INDEX.md") return { ok: false, reason: "reserved" };
  if (sectorKind === "spine" && (segments[0] === "brains" || segments[0] === ".cortex")) return { ok: false, reason: "reserved" };
  if (segments[0] === ".cortex" || segments[0] === ".git") return { ok: false, reason: "reserved" };
  return { ok: true };
}
