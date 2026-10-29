import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Models } from "node-appwrite";
import { ID, Query, TablesDB, Teams, Users } from "node-appwrite";
import { createSector, getSectorRole, setRole } from "@cortex/access";
import { createTablesAuditSink } from "@cortex/audit";
import type { SectorColorToken } from "@cortex/core/sector-colors";
import { databaseIds, loadServerEnv } from "@cortex/config";
import { KnowledgeStore, createAppwriteEmbedder, defaultEmbedderOptions, ingestFile, setDocumentStatus } from "@cortex/knowledge";
import type { Caller } from "@cortex/server-kit";
import { createAdminClient, toCaller } from "@cortex/server-kit";
import { ingestOrder, loadDemoManifest, statusSteps } from "../demo/manifest";
import { upsertEnvFile } from "../env-file";
import { envFilePath, repositoryRoot } from "../repository-paths";

const passwordKeys = { admin: "CORTEX_DEMO_PASSWORD_ADMIN", maintainer: "CORTEX_DEMO_PASSWORD_MAINTAINER", reader: "CORTEX_DEMO_PASSWORD_READER" } as const;

export async function runSeed(log: (line: string) => void): Promise<number> {
  const env = loadServerEnv(process.env);
  const { manifest, contents } = await loadDemoManifest(path.join(repositoryRoot, "demo/seed.json"), path.join(repositoryRoot, "demo/corpus"));
  const admin = createAdminClient(env);
  const ids = databaseIds(env.CORTEX_DATABASE_NAMESPACE);
  const tables = new TablesDB(admin);
  const users = new Users(admin);
  const audit = createTablesAuditSink(tables, ids);
  const accessDeps = { admin: { tables, teams: new Teams(admin), users }, ids: { tables: ids.tables }, audit, includeTestIdentities: false };

  const generated: Record<string, string> = {};
  const accountIds = new Map<string, string>();
  const callers = new Map<string, Caller>();
  for (const account of manifest.accounts) {
    const existing = (await users.list({ queries: [Query.equal("email", [account.email])] })).users[0];
    let user: Models.User<Models.Preferences>;
    if (existing === undefined) {
      const key = passwordKeys[account.key];
      const password = process.env[key] !== undefined && process.env[key] !== "" ? process.env[key] : randomBytes(18).toString("base64url");
      if (process.env[key] === undefined || process.env[key] === "") generated[key] = password;
      user = await users.create({ userId: ID.unique(), email: account.email, password, name: account.name });
      log(`account ${account.name}: created`);
    } else {
      user = existing;
    }
    const labels = account.admin ? [...new Set([...user.labels, "admin"])] : user.labels.filter((label) => label !== "admin");
    if (labels.join(",") !== user.labels.join(",")) user = await users.updateLabels({ userId: user.$id, labels });
    accountIds.set(account.name, user.$id);
    callers.set(account.key, toCaller(user, "web"));
  }
  if (Object.keys(generated).length > 0) {
    const file = envFilePath();
    await writeFile(file, upsertEnvFile(await readFile(file, "utf8").catch(() => ""), generated), { mode: 0o600 });
    log(`wrote ${Object.keys(generated).join(", ")} to ${path.basename(file)}`);
  }
  const actor = callers.get("admin");
  if (actor === undefined) throw new Error("demo-admin missing");

  for (const sector of manifest.sectors) {
    const exists = await tables.getRow({ databaseId: ids.tables, tableId: "sectors", rowId: sector.slug }).then(() => true).catch(() => false);
    if (exists) continue;
    await createSector(actor, { name: sector.name, slug: sector.slug, color: sector.color as SectorColorToken, description: sector.description }, accessDeps);
    log(`sector ${sector.slug}: created`);
  }

  for (const account of manifest.accounts) {
    const userId = accountIds.get(account.name) as string;
    for (const membership of account.memberships) {
      const caller = toCaller({ $id: userId, name: account.name, email: account.email, labels: [] }, "web");
      if ((await getSectorRole(caller, membership.sector, accessDeps)) === membership.role) continue;
      await setRole(actor, { userId, sectorId: membership.sector, role: membership.role }, accessDeps);
      log(`${account.name}: ${membership.role} in ${membership.sector}`);
    }
  }

  const knowledge = {
    admin,
    ids,
    access: { getSectorRole: (caller: Caller, sectorId: string) => getSectorRole(caller, sectorId, accessDeps) },
    audit,
    embedder: createAppwriteEmbedder(admin, { ...defaultEmbedderOptions, prefixMode: env.CORTEX_EMBEDDING_PREFIX_MODE }),
    newId: () => ID.unique(),
    now: () => new Date(),
  };
  const store = new KnowledgeStore(admin, ids);
  let changed = 0;
  for (const file of ingestOrder(manifest.files)) {
    const existing = await store.fileByPath(file.sector, file.path);
    if (existing !== null && existing.content.trim() === (contents.get(file) ?? "").trim()) continue;
    const result = await ingestFile(knowledge, actor, {
      sectorId: file.sector,
      path: file.path,
      content: contents.get(file) ?? "",
      baseVersion: existing?.version ?? null,
      baseHash: existing?.hash ?? null,
      declared: { ...(file.supersedes === undefined ? {} : { supersedes: file.supersedes }), ...(file.relatesTo === undefined ? {} : { relatesTo: file.relatesTo }) },
    });
    if (result.status !== "unchanged") {
      changed += 1;
      log(`${result.status} ${file.sector}/${file.path}`);
    }
  }
  for (const file of manifest.files) {
    if (file.status === undefined) continue;
    const row = await store.fileByPath(file.sector, file.path);
    if (row?.docId === null || row === null) continue;
    for (const step of statusSteps(file.status, row.status)) {
      await setDocumentStatus(knowledge, actor, { sectorId: file.sector, docId: row.docId, status: step });
      changed += 1;
      log(`status ${file.sector}/${row.docId} -> ${step}`);
    }
  }
  log(changed === 0 ? "0 changes" : `${changed} changes`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSeed((line) => process.stdout.write(`${line}\n`))
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    });
}
