import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ID, Permission, Role, TablesDB, Teams, Users } from "node-appwrite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { noopAuditSink } from "@cortex/audit";
import { databaseIds, gatewayFunctionId, loadServerEnv } from "@cortex/config";
import { createAdminClient, serverEndpoint, toCaller } from "@cortex/server-kit";
import { TokenService } from "@cortex/tokens";
import { AppwriteSessionPort, AppwriteTokenRepository, AppwriteUserDirectory } from "@cortex/tokens/appwrite";
import { writeCredentials } from "../src/credentials";
import { run } from "../src/run";

const env = loadServerEnv(process.env);
const namespace = env.CORTEX_TEST_DATABASE_NAMESPACE;
const admin = createAdminClient(env);
const ids = databaseIds(namespace);
const tables = new TablesDB(admin);
const users = new Users(admin);
const teams = new Teams(admin);
const stamp = `${Date.now().toString(36)}${randomBytes(2).toString("hex")}`;
const slug = `test-alpha-${stamp}`;
const teamId = `sector-${slug}`;
const created: string[] = [];
const tokenService = new TokenService({ tokens: new AppwriteTokenRepository(tables, ids.tables), sessions: new AppwriteSessionPort(users), users: new AppwriteUserDirectory(users), audit: noopAuditSink, now: () => new Date(), random: randomBytes });

interface Developer {
  userId: string;
  membershipId: string;
  credentials: string;
}

const developers: Record<"ada" | "max", Developer> = {} as Record<"ada" | "max", Developer>;

async function developer(name: "ada" | "max", role: "maintainer" | "reader"): Promise<Developer> {
  const user = await users.create({ userId: ID.unique(), email: `test-${name}-${stamp}@example.com`, password: randomBytes(18).toString("base64url"), name: `test-${name}-${stamp}` });
  created.push(user.$id);
  const membership = await teams.createMembership({ teamId, userId: user.$id, roles: [role] });
  const token = await tokenService.create(toCaller(user, "web"), { name: "cli", scope: "write", expiresInDays: 7 });
  const credentials = path.join(await mkdtemp(path.join(tmpdir(), `cortex-${name}-`)), "credentials.json");
  await writeCredentials(credentials, { schema: 1, endpoint: serverEndpoint(env), projectId: env.APPWRITE_PROJECT_ID, functionId: gatewayFunctionId(namespace), token: token.value, userId: user.$id, name: user.name, scope: "write", expiresAt: token.record.expiresAt });
  return { userId: user.$id, membershipId: membership.$id, credentials };
}

async function cortex(who: Developer, root: string, ...args: string[]): Promise<{ code: number; out: string }> {
  let out = "";
  const code = await run(args, { env: { CORTEX_CREDENTIALS_FILE: who.credentials, CORTEX_ROOT: root }, cwd: root, stdout: (text) => (out += text), stderr: (text) => (out += text) });
  return { code, out };
}

const note = (root: string, file: string) => path.join(root, "brains", slug, file);

beforeAll(async () => {
  await teams.create({ teamId, name: slug, roles: ["maintainer", "reader"] });
  await tables.createRow({ databaseId: ids.tables, tableId: "sectors", rowId: slug, data: { slug, name: "Alpha", kind: "project", teamId, color: "#1b6a6b" }, permissions: [Permission.read(Role.users())] });
  developers.ada = await developer("ada", "maintainer");
  developers.max = await developer("max", "reader");
});

afterAll(async () => {
  for (const userId of created) await users.delete({ userId }).catch(() => undefined);
  await tables.deleteRow({ databaseId: ids.tables, tableId: "sectors", rowId: slug }).catch(() => undefined);
  await teams.delete({ teamId }).catch(() => undefined);
});

describe("cortex sync", () => {
  let adaRoot: string;
  let maxRoot: string;

  it("pushes new files and pulls them with managed frontmatter and a read-only index", async () => {
    adaRoot = await mkdtemp(path.join(tmpdir(), "cortex-ada-"));
    maxRoot = await mkdtemp(path.join(tmpdir(), "cortex-max-"));
    expect((await cortex(developers.ada, adaRoot, "pull")).code).toBe(0);
    await mkdir(note(adaRoot, "specs/development"), { recursive: true });
    await mkdir(note(adaRoot, "notes"), { recursive: true });
    await writeFile(note(adaRoot, "notes/rollback.md"), "# Rollback\n\nRedeploy the previous image tag.\n\n## Afterwards\n\nOpen an incident note.\n");
    await writeFile(note(adaRoot, "specs/development/SPEC-001-sync.md"), "# Sync\n\nFirst design of the sync.\n");
    const pushed = await cortex(developers.ada, adaRoot, "push");
    expect(pushed.code).toBe(0);
    expect(pushed.out).toContain("created");
    expect(await readFile(note(adaRoot, "specs/development/SPEC-001-sync.md"), "utf8")).toContain("id: SPEC-001");

    expect((await cortex(developers.max, maxRoot, "pull")).code).toBe(0);
    expect(await readFile(note(maxRoot, "notes/rollback.md"), "utf8")).toContain("Redeploy the previous image tag.");
    const spec = await readFile(note(maxRoot, "specs/development/SPEC-001-sync.md"), "utf8");
    expect(spec).toMatch(/^---\nid: SPEC-001\nstatus: draft\n---\n/);
    const index = path.join(maxRoot, "brains", slug, "_INDEX.md");
    expect((await stat(index)).mode & 0o777).toBe(0o444);
    expect(await readFile(index, "utf8")).toContain("SPEC-001");

    const before = (await stat(note(maxRoot, "notes/rollback.md"))).mtimeMs;
    const again = await cortex(developers.max, maxRoot, "pull");
    expect(again.code).toBe(0);
    expect((await stat(note(maxRoot, "notes/rollback.md"))).mtimeMs).toBe(before);
  });

  it("keeps a reader's edits local", async () => {
    await writeFile(note(maxRoot, "notes/rollback.md"), "# Rollback\n\nReader edit.\n");
    const status = await cortex(developers.max, maxRoot, "status");
    expect(status.out).toContain("read-only");
    const pushed = await cortex(developers.max, maxRoot, "push");
    expect(pushed.code).toBe(0);
    expect(pushed.out).toContain("read-only");
    expect(pushed.out).not.toContain("updated");
  });

  it("merges disjoint edits of the same file from two working copies", async () => {
    const secondRoot = await mkdtemp(path.join(tmpdir(), "cortex-ada2-"));
    expect((await cortex(developers.ada, secondRoot, "pull")).code).toBe(0);
    await writeFile(note(adaRoot, "notes/rollback.md"), "# Rollback\n\nRedeploy the previous image tag and restore the snapshot.\n\n## Afterwards\n\nOpen an incident note.\n");
    expect((await cortex(developers.ada, adaRoot, "push")).out).toContain("updated");
    await writeFile(note(secondRoot, "notes/rollback.md"), "# Rollback\n\nRedeploy the previous image tag.\n\n## Afterwards\n\nOpen an incident note and tell the team.\n");
    const second = await cortex(developers.ada, secondRoot, "push");
    expect(second.out).toContain("merged");
    const merged = await readFile(note(secondRoot, "notes/rollback.md"), "utf8");
    expect(merged).toContain("restore the snapshot");
    expect(merged).toContain("tell the team");
  });

  it("refuses edits of an approved spec with a correction hint", async () => {
    const approved = await cortex(developers.ada, adaRoot, "status", "SPEC-001", "approved");
    expect(approved.code).toBe(0);
    expect(await readFile(note(adaRoot, "specs/development/SPEC-001-sync.md"), "utf8")).toContain("status: approved");
    await writeFile(note(adaRoot, "specs/development/SPEC-001-sync.md"), "---\nid: SPEC-001\nstatus: approved\n---\n# Sync\n\nChanged after approval.\n");
    const pushed = await cortex(developers.ada, adaRoot, "push");
    expect(pushed.out).toContain("approved and read-only");
    expect(pushed.out).toContain("cortex reserve spec");
    expect(await readFile(note(adaRoot, "specs/development/SPEC-001-sync.md"), "utf8")).toContain("Changed after approval.");
  });

  it("reserves a document ID and creates the file from a template", async () => {
    const reserved = await cortex(developers.ada, path.join(adaRoot, "brains", slug), "reserve", "spec", "--create", "sync-v2", "--root", adaRoot);
    expect(reserved.code).toBe(0);
    const id = /(SPEC-\d{3})/.exec(reserved.out)?.[1] ?? "";
    expect(id).not.toBe("SPEC-001");
    expect(await readFile(note(adaRoot, `specs/development/${id}-sync-v2.md`), "utf8")).toContain(`id: ${id}`);
  });

  it("quarantines a file with a secret and still sends the rest", async () => {
    await writeFile(note(adaRoot, "notes/env.md"), `# Env\n\nAWS_SECRET_ACCESS_KEY=${randomBytes(30).toString("base64")}\n`);
    await writeFile(note(adaRoot, "notes/caching.md"), "# Caching\n\nPurge the CDN after image changes.\n");
    const pushed = await cortex(developers.ada, adaRoot, "push", "--strict");
    expect(pushed.code).toBe(3);
    expect(pushed.out).toContain("quarantined");
    expect(pushed.out).toContain("notes/caching.md");
    expect(await readdir(path.join(adaRoot, ".cortex", "quarantine", "brains", slug, "notes"))).toEqual(["env.md"]);
    expect((await cortex(developers.max, maxRoot, "pull")).code).toBe(0);
    await expect(stat(note(maxRoot, "notes/env.md"))).rejects.toThrow();
    expect(await readFile(note(maxRoot, "notes/caching.md"), "utf8")).toContain("Purge the CDN");
  });

  it("searches as the developer and moves a revoked sector aside", async () => {
    const found = await cortex(developers.max, maxRoot, "search", "how do I undo a broken release", "--json");
    expect(found.out).toContain("notes/rollback.md");
    await teams.deleteMembership({ teamId, membershipId: developers.max.membershipId });
    const pulled = await cortex(developers.max, maxRoot, "pull");
    expect(pulled.out).toContain("access to");
    await expect(stat(path.join(maxRoot, "brains", slug))).rejects.toThrow();
    expect((await readdir(path.join(maxRoot, ".cortex", "revoked"))).some((entry) => entry.startsWith(slug))).toBe(true);
    const after = await cortex(developers.max, maxRoot, "search", "how do I undo a broken release", "--json");
    expect(after.out).not.toContain("notes/rollback.md");
  });
});
