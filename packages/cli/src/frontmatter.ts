import { bodyHash, splitFrontmatter, stripManagedFrontmatter } from "@cortex/core/body-hash";
import type { DocumentMeta } from "@cortex/gateway-contract";
import { renderManagedFrontmatter } from "@cortex/knowledge/frontmatter";

export { bodyHash };

const managedLine = /^(id|status|supersedes|superseded_by|relates_to)\s*:\s*(.*)$/;

export function managedValues(content: string): Record<string, string> {
  const { block } = splitFrontmatter(content);
  const values: Record<string, string> = {};
  for (const line of block ?? []) {
    const match = managedLine.exec(line);
    if (match?.[1] !== undefined) values[match[1]] = (match[2] ?? "").trim().replace(/^["']|["']$/g, "");
  }
  return values;
}

const docIdPattern = /^[A-Z]+-\d{3,4}$/;

export function stripManaged(content: string): { text: string; declared: { supersedes: string | null; relatesTo: string | null } } {
  const values = managedValues(content);
  const supersedes = values.supersedes !== undefined && docIdPattern.test(values.supersedes) ? values.supersedes : null;
  const relatesTo = values.relates_to !== undefined && docIdPattern.test(values.relates_to) ? values.relates_to : null;
  return { text: stripManagedFrontmatter(content), declared: { supersedes, relatesTo } };
}

export function editedManagedKeys(content: string, meta: DocumentMeta): string[] {
  const values = managedValues(content);
  const expected: Record<string, string | null> = { id: meta.docId, status: meta.status, supersedes: meta.supersedes, superseded_by: meta.supersededBy, relates_to: meta.relatesTo };
  return Object.entries(expected)
    .filter(([key, value]) => (values[key] ?? null) !== value)
    .map(([key]) => key);
}

export function writeManaged(content: string, meta: DocumentMeta): string {
  return renderManagedFrontmatter(stripManagedFrontmatter(content), meta);
}
