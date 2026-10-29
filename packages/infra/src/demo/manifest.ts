import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { sectorColorTokens } from "@cortex/core/sector-colors";
import { validateSyncPath } from "@cortex/core/sync-path";

const slug = z.string().regex(/^[a-z0-9-]{2,64}$/);
const docId = z.string().regex(/^(SPEC|TASK|FINDING)-\d{3,4}$/);

export const demoManifestSchema = z.object({
  sectors: z.array(z.object({ slug, name: z.string().min(2).max(128), color: z.enum(sectorColorTokens), description: z.string().max(512) })),
  accounts: z
    .array(
      z.object({
        key: z.enum(["admin", "maintainer", "reader"]),
        name: z.string().regex(/^demo-[a-z]+$/),
        email: z.email().refine((value) => value.endsWith("@example.com"), { message: "example.com only" }),
        admin: z.boolean(),
        memberships: z.array(z.object({ sector: slug, role: z.enum(["reader", "maintainer"]) })),
      }),
    )
    .length(3),
  files: z.array(
    z.object({
      sector: z.string(),
      file: z.string().regex(/^[a-z0-9][a-z0-9._-]*\.md$/i),
      path: z.string(),
      status: z.enum(["draft", "approved", "in_progress", "implemented"]).optional(),
      supersedes: docId.optional(),
      relatesTo: docId.optional(),
    }),
  ),
});

export type DemoManifest = z.infer<typeof demoManifestSchema>;
export type DemoFile = DemoManifest["files"][number];

export class DemoManifestError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid demo manifest:\n  ${problems.join("\n  ")}`);
    this.name = "DemoManifestError";
  }
}

export function checkManifest(manifest: DemoManifest): string[] {
  const problems: string[] = [];
  const sectors = new Set(["spine", ...manifest.sectors.map((sector) => sector.slug)]);
  if (manifest.sectors.some((sector) => sector.slug === "spine")) problems.push("spine is built in and must not be declared");
  const seen = new Set<string>();
  for (const file of manifest.files) {
    if (!sectors.has(file.sector)) problems.push(`${file.file}: unknown sector ${file.sector}`);
    const check = validateSyncPath(file.path, file.sector === "spine" ? "spine" : "project");
    if (!check.ok) problems.push(`${file.file}: path ${file.path} is ${check.reason}`);
    const key = `${file.sector}/${file.path}`;
    if (seen.has(key)) problems.push(`${key}: declared twice`);
    seen.add(key);
    if (file.relatesTo !== undefined && !manifest.files.some((other) => other.sector === file.sector && other.path.includes(`/${file.relatesTo}-`))) problems.push(`${file.file}: relates to unknown ${file.relatesTo}`);
    if (file.supersedes !== undefined && !manifest.files.some((other) => other.sector === file.sector && other.path.includes(`/${file.supersedes}-`))) problems.push(`${file.file}: supersedes unknown ${file.supersedes}`);
  }
  for (const account of manifest.accounts) {
    for (const membership of account.memberships) if (!sectors.has(membership.sector) || membership.sector === "spine") problems.push(`${account.name}: membership in unknown sector ${membership.sector}`);
  }
  return problems;
}

export async function loadDemoManifest(manifestFile: string, corpusRoot: string): Promise<{ manifest: DemoManifest; contents: Map<DemoFile, string> }> {
  const parsed = demoManifestSchema.safeParse(JSON.parse(await readFile(manifestFile, "utf8")));
  if (!parsed.success) throw new DemoManifestError(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`));
  const problems = checkManifest(parsed.data);
  const contents = new Map<DemoFile, string>();
  for (const file of parsed.data.files) {
    const source = path.join(corpusRoot, file.sector, file.file);
    try {
      await stat(source);
      contents.set(file, await readFile(source, "utf8"));
    } catch {
      problems.push(`${file.sector}/${file.file}: missing in the corpus`);
    }
  }
  if (problems.length > 0) throw new DemoManifestError(problems);
  return { manifest: parsed.data, contents };
}

export function statusSteps(target: "draft" | "approved" | "in_progress" | "implemented" | undefined, current: string | null): Array<"approved" | "in_progress" | "implemented"> {
  const order = ["draft", "approved", "in_progress", "implemented"] as const;
  if (target === undefined || current === null) return [];
  const from = order.indexOf(current as (typeof order)[number]);
  const to = order.indexOf(target);
  if (from === -1 || to <= from) return [];
  return order.slice(from + 1, to + 1) as Array<"approved" | "in_progress" | "implemented">;
}

export function ingestOrder(files: DemoFile[]): DemoFile[] {
  const rank = (file: DemoFile) => (file.relatesTo !== undefined ? 2 : file.supersedes !== undefined ? 1 : 0);
  return [...files].sort((a, b) => rank(a) - rank(b));
}
