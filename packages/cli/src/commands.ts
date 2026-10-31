import { readFile } from "node:fs/promises";
import path from "node:path";
import { scanForSecrets } from "@cortex/core/secrets";
import { createInterface } from "node:readline";
import { routes } from "@cortex/gateway-contract";
import type { Credentials } from "./credentials";
import { readCredentials, removeCredentials, writeCredentials } from "./credentials";
import type { ReservableKind } from "./doc-templates";
import { reservedPath, templateFor } from "./doc-templates";
import { validateEndpoint } from "./endpoint";
import type { SyncContext } from "./engine";
import { pull, push, report } from "./engine";
import { CliError, exitCodes } from "./errors";
import { writeLocal } from "./files";
import { stripManaged } from "./frontmatter";
import { GatewayClient } from "./gateway-client";
import { localPathFor, locate } from "./layout";
import type { Output } from "./output";
import { readState } from "./state";

export interface CommandEnv {
  root: string;
  cwd: string;
  credentialsFile: string;
  out: Output;
  fetch: typeof fetch;
  readStdin: () => Promise<string>;
  promptHidden: (question: string) => Promise<string>;
}

export type Flags = Record<string, string | boolean | undefined>;

function client(credentials: Credentials, fetchImpl: typeof fetch): GatewayClient {
  return new GatewayClient({ endpoint: credentials.endpoint, projectId: credentials.projectId, functionId: credentials.functionId }, credentials.token, fetchImpl);
}

export async function syncContext(env: CommandEnv): Promise<SyncContext> {
  const credentials = await readCredentials(env.credentialsFile);
  return {
    root: env.root,
    client: client(credentials, env.fetch),
    out: env.out,
    identity: { endpoint: credentials.endpoint, projectId: credentials.projectId, userId: credentials.userId },
    scope: credentials.scope,
  };
}

export async function login(env: CommandEnv, flags: Flags): Promise<number> {
  const previous = await readCredentials(env.credentialsFile).catch(() => null);
  const endpoint = typeof flags.endpoint === "string" ? flags.endpoint : previous?.endpoint;
  const projectId = typeof flags.project === "string" ? flags.project : previous?.projectId;
  const functionId = typeof flags.function === "string" ? flags.function : (previous?.functionId ?? "cli-gateway");
  if (endpoint === undefined || projectId === undefined) throw new CliError("Use: cortex login --endpoint <url> --project <id>", exitCodes.usage);
  const checked = validateEndpoint(endpoint);
  if (!checked.ok) throw new CliError(checked.reason === "insecure_http" ? "Use https, or http only for localhost." : "The endpoint is not a valid http(s) URL.", exitCodes.usage);
  if (!/^[a-z0-9-]{1,36}$/.test(projectId)) throw new CliError("The project ID is not valid.", exitCodes.usage);
  const token = (flags["token-stdin"] === true ? await env.readStdin() : await env.promptHidden("Paste your Cortex token: ")).trim();
  if (!/^cbt_[a-z2-7]{8}_[A-Za-z0-9_-]{43}$/.test(token)) throw new CliError("That does not look like a Cortex token.", exitCodes.usage);
  const gateway = new GatewayClient({ endpoint: checked.url.toString().replace(/\/$/, ""), projectId, functionId }, token, env.fetch);
  const me = await gateway.call("whoami", {});
  await writeCredentials(env.credentialsFile, { schema: 1, endpoint: checked.url.toString().replace(/\/$/, ""), projectId, functionId, token, userId: me.userId, name: me.name, scope: me.scope, expiresAt: me.expiresAt });
  env.out.info(`Signed in as ${me.name} (${me.scope === "read" ? "read only" : "read and write"}, expires ${me.expiresAt.slice(0, 10)}). Sectors: ${me.sectors.map((sector) => sector.slug).join(", ")}.`);
  return exitCodes.ok;
}

export async function logout(env: CommandEnv): Promise<number> {
  const removed = await removeCredentials(env.credentialsFile);
  env.out.info(removed ? "Signed out. Revoke the token in the web app if this machine is no longer trusted." : "You were not signed in.");
  return exitCodes.ok;
}

function sectorFromCwd(env: CommandEnv): string | null {
  const relative = path.relative(env.root, env.cwd).split(path.sep).join("/");
  const match = /^brains\/([a-z0-9-]{1,64})(\/|$)/.exec(relative);
  return match?.[1] ?? null;
}

export async function reserve(env: CommandEnv, flags: Flags, kind: string | undefined): Promise<number> {
  if (kind !== "spec" && kind !== "backlog" && kind !== "finding") throw new CliError("Use: cortex reserve <spec|backlog|finding> [--sector <slug>] [--create <slug>] [--relates <ID>]", exitCodes.usage);
  if (typeof flags.create === "string" && !/^[a-z0-9-]{1,64}$/.test(flags.create)) throw new CliError("The file slug may contain only lowercase letters, digits and dashes.", exitCodes.usage);
  const ctx = await syncContext(env);
  const slug = typeof flags.sector === "string" ? flags.sector : sectorFromCwd(env);
  if (slug === null) throw new CliError("Run inside brains/<sector>/ or pass --sector <slug>.", exitCodes.usage);
  const manifest = await ctx.client.call("manifest", {});
  const sector = manifest.sectors.find((entry) => entry.slug === slug);
  if (sector === undefined) throw new CliError(`You have no access to a sector called ${slug}.`, exitCodes.usage);
  const relates = typeof flags.relates === "string" ? flags.relates : null;
  if (kind === "finding" && relates === null && typeof flags.create === "string") throw new CliError("A finding needs --relates <SPEC-ID>.", exitCodes.usage);
  const reservation = await ctx.client.call("docsReserve", { sectorId: sector.id, kind: kind as ReservableKind });
  env.out.line("+", "reserved", "success", `${reservation.docId} until ${reservation.reservedUntil.slice(0, 16).replace("T", " ")}`);
  env.out.data(reservation);
  if (typeof flags.create === "string") {
    const localPath = localPathFor(sector, reservedPath(kind as ReservableKind, reservation.docId, flags.create));
    const title = typeof flags.title === "string" ? flags.title : flags.create.replace(/-/g, " ");
    if (!(await writeLocal(env.root, localPath, templateFor(kind as ReservableKind, reservation.docId, title, relates)))) throw new CliError(`${localPath} already exists.`, exitCodes.usage);
    env.out.line("+", "created", "success", localPath);
  }
  return exitCodes.ok;
}

export async function statusSet(env: CommandEnv, docId: string, status: string): Promise<number> {
  const ctx = await syncContext(env);
  if (!["draft", "approved", "in_progress", "implemented", "deprecated"].includes(status)) throw new CliError("Status must be draft, approved, in_progress, implemented or deprecated.", exitCodes.usage);
  const state = await readState(env.root, ctx.identity);
  const file = Object.values(state?.files ?? {}).find((entry) => entry.meta.docId === docId);
  if (file === undefined) throw new CliError(`${docId} is not in this directory. Run cortex pull first.`, exitCodes.usage);
  const result = await ctx.client.call("docsStatus", { sectorId: file.sectorId, docId, status: status as "draft" | "approved" | "in_progress" | "implemented" | "deprecated" });
  env.out.line("~", "status", "success", `${result.docId} is now ${result.status}${result.superseded === null ? "" : `; ${result.superseded} is superseded`}`);
  await pull(ctx);
  return exitCodes.ok;
}

export async function search(env: CommandEnv, flags: Flags, query: string): Promise<number> {
  const ctx = await syncContext(env);
  const input = routes.search.input.parse({ query, includeSuperseded: flags["include-superseded"] === true, limit: 8 });
  const { results } = await ctx.client.call("search", input);
  env.out.data(results);
  if (results.length === 0) env.out.info("No matches. Try describing the problem in other words.");
  for (const hit of results) {
    const badge = hit.docId === null ? "" : `  [${hit.docId} ${hit.status}]`;
    env.out.info(`${Math.round(hit.similarity * 100)}%  ${hit.sectorName}/${hit.path}  > ${hit.heading}${badge}\n    ${hit.snippet}`);
  }
  return exitCodes.ok;
}

export async function propose(env: CommandEnv, flags: Flags, file: string | undefined): Promise<number> {
  if (file === undefined || (flags.as !== "standard" && flags.as !== "procedure")) throw new CliError('Use: cortex propose <file> --as standard|procedure [--path <spine path>] --message "<why>"', exitCodes.usage);
  if (typeof flags.message !== "string" || flags.message.trim() === "") throw new CliError('Explain why with --message "<why the whole team should follow this>".', exitCodes.usage);
  const absolute = path.resolve(env.cwd, file);
  const relative = path.relative(env.root, absolute).split(path.sep).join("/");
  const { text } = stripManaged(await readFile(absolute, "utf8"));
  const findings = scanForSecrets(text);
  if (findings.length > 0) throw new CliError(`${file} looks like it contains a secret (line ${findings[0]?.line ?? "?"}). Remove it and try again.`, exitCodes.secret);
  const ctx = await syncContext(env);
  const manifest = await ctx.client.call("manifest", {});
  const location = relative.startsWith("..") ? null : locate(relative, manifest.sectors);
  const inSpine = location?.sector.kind === "spine" && /^(standards|procedures)\//.test(location.path);
  const targetPath = typeof flags.path === "string" ? flags.path : inSpine ? (location?.path ?? null) : null;
  if (targetPath === null) throw new CliError("Name the spine path with --path standards/<name>.md or procedures/<name>.md.", exitCodes.usage);
  const spine = manifest.sectors.find((sector) => sector.kind === "spine");
  const existing = manifest.files.find((entry) => entry.sectorId === spine?.id && entry.path === targetPath);
  const title = /^#\s+(.+)$/m.exec(text)?.[1]?.trim() ?? path.basename(targetPath, ".md");
  const source = location !== null && location.sector.kind === "project" ? { sectorId: location.sector.id, path: location.path } : null;
  const result = await ctx.client.call("proposalsSubmit", { kind: flags.as, targetPath, baseVersion: existing?.version ?? null, title: title.slice(0, 200), rationale: flags.message.trim(), content: text, source });
  env.out.line("+", "proposed", "success", `${targetPath} (${existing === undefined ? "new" : `change of v${existing.version}`}); an admin will review it. Proposal ${result.proposalId}`);
  env.out.data(result);
  return exitCodes.ok;
}

export async function promptHidden(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const output = rl as unknown as { _writeToOutput: (text: string) => void };
  let asked = false;
  output._writeToOutput = (text: string) => {
    if (!asked) {
      process.stdout.write(text);
      asked = true;
    }
  };
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

export { pull, push, report };
