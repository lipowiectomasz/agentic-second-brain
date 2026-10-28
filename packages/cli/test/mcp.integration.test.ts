import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ID, Permission, Role, TablesDB, Teams, Users } from "node-appwrite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSectorRole } from "@cortex/access";
import { noopAuditSink } from "@cortex/audit";
import { databaseIds, gatewayFunctionId, loadServerEnv } from "@cortex/config";
import { createAppwriteEmbedder, ingestFile } from "@cortex/knowledge";
import { createAdminClient, serverEndpoint, toCaller } from "@cortex/server-kit";
import { TokenService } from "@cortex/tokens";
import { AppwriteSessionPort, AppwriteTokenRepository, AppwriteUserDirectory } from "@cortex/tokens/appwrite";
import { writeCredentials } from "../src/credentials";

const run = promisify(execFile);
const env = loadServerEnv(process.env);
const namespace = env.CORTEX_TEST_DATABASE_NAMESPACE;
const admin = createAdminClient(env);
const ids = databaseIds(namespace);
const tables = new TablesDB(admin);
const users = new Users(admin);
const teams = new Teams(admin);
const stamp = `${Date.now().toString(36)}${randomBytes(2).toString("hex")}`;
const visible = `test-mcp-a-${stamp}`;
const hidden = `test-mcp-b-${stamp}`;
const tokenService = new TokenService({ tokens: new AppwriteTokenRepository(tables, ids.tables), sessions: new AppwriteSessionPort(users), users: new AppwriteUserDirectory(users), audit: noopAuditSink, now: () => new Date(), random: randomBytes });
const accessDeps = { admin: { tables, teams, users }, ids: { tables: ids.tables }, audit: noopAuditSink, includeTestIdentities: true };
const writeDeps = { admin, ids, access: { getSectorRole: (caller: Parameters<typeof getSectorRole>[0], sectorId: string) => getSectorRole(caller, sectorId, accessDeps) }, audit: noopAuditSink, embedder: createAppwriteEmbedder(admin), newId: () => ID.unique(), now: () => new Date() };
const writer = toCaller({ $id: "test-writer", name: "test-writer", email: "writer@example.com", labels: ["admin"] }, "web");
const longFile = Array.from({ length: 1700 }, (_, index) => `Line ${index}: carriers throttle label requests during peak hours.`).join("\n");
let userId = "";
let tokenId = "";
let client: Client;

beforeAll(async () => {
  await run("node", ["build.mjs"], { cwd: path.resolve(import.meta.dirname, "..") });
  for (const slug of [visible, hidden]) {
    await teams.create({ teamId: `sector-${slug}`, name: slug, roles: ["maintainer", "reader"] });
    await tables.createRow({ databaseId: ids.tables, tableId: "sectors", rowId: slug, data: { slug, name: slug, kind: "project", teamId: `sector-${slug}`, color: "#1b6a6b" }, permissions: [Permission.read(Role.users())] });
  }
  await ingestFile(writeDeps, writer, { sectorId: visible, path: "notes/rollback.md", content: "# Rolling back\n\nWhen a release breaks production, redeploy the previous image tag.\n", baseVersion: null, baseHash: null });
  await ingestFile(writeDeps, writer, { sectorId: visible, path: "notes/long.md", content: `# Carrier limits\n\n${longFile}\n`, baseVersion: null, baseHash: null });
  await ingestFile(writeDeps, writer, { sectorId: hidden, path: "notes/revert.md", content: "# Reverting a release\n\nSwitch traffic back to the last healthy build when a release crashes.\n", baseVersion: null, baseHash: null });
  const user = await users.create({ userId: ID.unique(), email: `test-mcp-${stamp}@example.com`, password: randomBytes(18).toString("base64url"), name: `test-mcp-${stamp}` });
  userId = user.$id;
  await teams.createMembership({ teamId: `sector-${visible}`, userId, roles: ["reader"] });
  const token = await tokenService.create(toCaller(user, "web"), { name: "assistant", scope: "read", expiresInDays: 7 });
  tokenId = token.record.id;
  const credentials = path.join(await mkdtemp(path.join(tmpdir(), "cortex-mcp-")), "credentials.json");
  await writeCredentials(credentials, { schema: 1, endpoint: serverEndpoint(env), projectId: env.APPWRITE_PROJECT_ID, functionId: gatewayFunctionId(namespace), token: token.value, userId, name: user.name, scope: "read", expiresAt: token.record.expiresAt });
  client = new Client({ name: "integration", version: "1" });
  await client.connect(new StdioClientTransport({ command: "node", args: [path.resolve(import.meta.dirname, "../dist/cortex.mjs"), "mcp"], env: { ...process.env, CORTEX_CREDENTIALS_FILE: credentials } as Record<string, string>, stderr: "ignore" }));
});

afterAll(async () => {
  await client?.close();
  await users.delete({ userId }).catch(() => undefined);
  for (const slug of [visible, hidden]) {
    await tables.deleteRow({ databaseId: ids.tables, tableId: "sectors", rowId: slug }).catch(() => undefined);
    await teams.delete({ teamId: `sector-${slug}` }).catch(() => undefined);
  }
});

describe("cortex mcp", () => {
  it("answers search_brain only from the developer's sectors", async () => {
    const result = await client.callTool({ name: "search_brain", arguments: { query: "how do I undo a broken release", limit: 10 } });
    const text = JSON.stringify(result.content);
    expect(text).toContain(`[${visible}] notes/rollback.md`);
    expect(text).not.toContain(hidden);
  });

  it("pages a long file so the pages add up to the whole file", async () => {
    let offset: number | null = 0;
    let content = "";
    let pages = 0;
    while (offset !== null) {
      const page = await client.callTool({ name: "read_file", arguments: { sector: visible, path: "notes/long.md", offset } });
      const structured = page.structuredContent as { content: string; nextOffset: number | null; totalLength: number };
      content += structured.content;
      offset = structured.nextOffset;
      pages += 1;
    }
    expect(pages).toBe(3);
    expect(content).toContain("Line 0: carriers");
    expect(content).toContain("Line 1699: carriers");
  });

  it("finds related knowledge without the file itself", async () => {
    const result = await client.callTool({ name: "related", arguments: { sector: visible, path: "notes/rollback.md" } });
    expect(result.isError).not.toBe(true);
    expect(JSON.stringify(result.content)).not.toContain("notes/rollback.md >");
  });

  it("reports a revoked token as an error naming cortex login", async () => {
    await tokenService.revoke(toCaller({ $id: userId, name: "x", email: "x@example.com", labels: [] }, "web"), tokenId);
    const result = await client.callTool({ name: "search_brain", arguments: { query: "rollback" } });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("cortex login");
  });
});
