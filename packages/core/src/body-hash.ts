import { createHash } from "node:crypto";

export const managedFrontmatterKeys = ["id", "status", "supersedes", "superseded_by", "relates_to"] as const;

export type ManagedFrontmatterKey = (typeof managedFrontmatterKeys)[number];

const managedKeyLine = new RegExp(`^(${managedFrontmatterKeys.join("|")})\\s*:`);

export interface FrontmatterSplit {
  block: string[] | null;
  rest: string;
}

export function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n?/g, "\n");
}

export function splitFrontmatter(content: string): FrontmatterSplit {
  const normalized = normalizeLineEndings(content);
  if (!normalized.startsWith("---\n")) return { block: null, rest: normalized };
  const end = normalized.indexOf("\n---", 3);
  if (end === -1) return { block: null, rest: normalized };
  const afterDelimiter = normalized.slice(end + 4);
  if (afterDelimiter !== "" && !afterDelimiter.startsWith("\n")) return { block: null, rest: normalized };
  const inner = normalized.slice(4, end);
  return { block: inner === "" ? [] : inner.split("\n"), rest: afterDelimiter.startsWith("\n") ? afterDelimiter.slice(1) : afterDelimiter };
}

export function joinFrontmatter(block: string[] | null, rest: string): string {
  if (block === null || block.length === 0) return rest;
  return `---\n${block.join("\n")}\n---\n${rest}`;
}

export function stripManagedLines(block: string[]): string[] {
  const kept: string[] = [];
  let skipping = false;
  for (const line of block) {
    if (managedKeyLine.test(line)) {
      skipping = true;
      continue;
    }
    if (skipping && /^\s+\S/.test(line)) continue;
    skipping = false;
    kept.push(line);
  }
  return kept;
}

export function stripManagedFrontmatter(content: string): string {
  const { block, rest } = splitFrontmatter(content);
  if (block === null) return rest;
  return joinFrontmatter(stripManagedLines(block), rest);
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function bodyHash(content: string): string {
  return sha256Hex(stripManagedFrontmatter(content));
}
