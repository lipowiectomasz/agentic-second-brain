export type ReservableKind = "spec" | "backlog" | "finding";

export function reservedPath(kind: ReservableKind, docId: string, slug: string): string {
  if (kind === "spec") return `specs/development/${docId}-${slug}.md`;
  if (kind === "backlog") return `docs/backlog/${docId}-${slug}.md`;
  return `docs/findings/${docId}-${slug}.md`;
}

export function templateFor(kind: ReservableKind, docId: string, title: string, relates: string | null): string {
  const frontmatter = [`id: ${docId}`, ...(kind === "finding" ? [] : ["status: draft"]), ...(relates === null ? [] : [`relates_to: ${relates}`])];
  return `---\n${frontmatter.join("\n")}\n---\n# ${title}\n\n`;
}
