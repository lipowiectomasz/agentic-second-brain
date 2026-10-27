import type { DocumentStatus } from "@cortex/core";
import { joinFrontmatter, splitFrontmatter, stripManagedLines } from "@cortex/core";

export interface ManagedRowFields {
  docId: string | null;
  status: DocumentStatus | null;
  supersedes: string | null;
  supersededBy: string | null;
  relatesTo: string | null;
}

export function renderManagedFrontmatter(stored: string, row: ManagedRowFields): string {
  const managed: string[] = [];
  if (row.docId !== null) managed.push(`id: ${row.docId}`);
  if (row.status !== null) managed.push(`status: ${row.status}`);
  if (row.supersedes !== null) managed.push(`supersedes: ${row.supersedes}`);
  if (row.supersededBy !== null) managed.push(`superseded_by: ${row.supersededBy}`);
  if (row.relatesTo !== null) managed.push(`relates_to: ${row.relatesTo}`);
  if (managed.length === 0) return stored;
  const { block, rest } = splitFrontmatter(stored);
  return joinFrontmatter([...managed, ...stripManagedLines(block ?? [])], rest);
}

export function bodyOf(stored: string): string {
  return splitFrontmatter(stored).rest;
}
