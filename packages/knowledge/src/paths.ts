import type { FileKind, SectorKind } from "@cortex/core";
import type { KnowledgeErrorDetails } from "./types";

interface PathRule {
  kind: FileKind;
  matches: (path: string) => boolean;
  docPattern?: RegExp;
  sectors: readonly SectorKind[];
}

const docFile = (prefix: string, separator: string) => new RegExp(`(?:^|/)(${prefix}-\\d{3,4})${separator}[^/]+\\.md$`);

const rules: PathRule[] = [
  { kind: "standard", matches: (path) => path.startsWith("standards/"), sectors: ["spine"] },
  { kind: "procedure", matches: (path) => path.startsWith("procedures/"), sectors: ["spine"] },
  { kind: "spec", matches: (path) => path.startsWith("specs/"), docPattern: docFile("SPEC", "-"), sectors: ["project"] },
  { kind: "backlog", matches: (path) => path.startsWith("docs/backlog/"), docPattern: docFile("TASK", "[-_]"), sectors: ["project"] },
  { kind: "finding", matches: (path) => path.startsWith("docs/findings/"), docPattern: docFile("FINDING", "-"), sectors: ["project"] },
  { kind: "memory", matches: (path) => /^memory\/[^/]+\/.+/.test(path), sectors: ["project"] },
  { kind: "module", matches: (path) => path === "AGENTS.md" || path.endsWith("/AGENTS.md"), sectors: ["spine", "project"] },
  { kind: "note", matches: () => true, sectors: ["spine", "project"] },
];

export function classifyPath(path: string, sectorKind: SectorKind): { kind: FileKind; docId: string | null } | { error: KnowledgeErrorDetails } {
  const rule = rules.find((candidate) => candidate.matches(path));
  if (rule === undefined) return { error: { code: "invalid_input", issues: ["unclassified_path"] } };
  if (!rule.sectors.includes(sectorKind)) return { error: { code: "invalid_input", issues: ["kind_not_allowed_in_sector"] } };
  if (rule.docPattern === undefined) return { kind: rule.kind, docId: null };
  const match = rule.docPattern.exec(path);
  if (match === null) return { error: { code: "invalid_input", issues: ["doc_path_pattern"] } };
  return { kind: rule.kind, docId: match[1] ?? null };
}

export function titleFromContent(body: string, path: string): string {
  let fence: string | null = null;
  for (const line of body.split("\n")) {
    const fenceMatch = /^(`{3,}|~{3,})/.exec(line);
    if (fenceMatch !== null) {
      const marker = fenceMatch[1] ?? "";
      if (fence === null) fence = marker;
      else if (marker.startsWith(fence[0] ?? "") && marker.length >= fence.length) fence = null;
      continue;
    }
    if (fence === null && /^# \S/.test(line)) return line.slice(2).trim().slice(0, 256);
  }
  const name = path.split("/").pop() ?? path;
  return name.replace(/\.md$/, "").slice(0, 256);
}
