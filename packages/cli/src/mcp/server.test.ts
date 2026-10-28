import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import type { ManifestData } from "@cortex/gateway-contract";
import { CliError, exitCodes } from "../errors";
import type { GatewayPort } from "./gateway-port";
import { createBrainServer } from "./server";

const rollbackFile: ManifestData["files"][number] = { fileId: "f1", sectorId: "s1", path: "notes/rollback.md", kind: "note", version: 2, hash: "a".repeat(64), size: 10, title: "Rollback", updatedAt: "2026-10-28T10:00:00.000+00:00", meta: { docId: null, status: null, supersedes: null, supersededBy: null, relatesTo: null, authorId: "u1" } };

const manifest: ManifestData = {
  authorSlug: "ada",
  sectors: [{ id: "s1", slug: "atlas", name: "Atlas", kind: "project", role: "reader" }],
  files: [rollbackFile],
};

const hit = { sectorId: "s1", sectorName: "Atlas", fileId: "f1", path: "notes/rollback.md", title: "Rollback", kind: "note" as const, heading: "Rollback", snippet: "Redeploy.", similarity: 0.9, docId: null, status: "active" };

function fakePort(overrides: Partial<GatewayPort> = {}): GatewayPort & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async search(input) {
      calls.push(`search:${input.sectorIds?.join(",") ?? ""}:${String(input.includeSuperseded)}`);
      return [hit];
    },
    async related(input) {
      calls.push(`related:${input.fileId}`);
      return [hit];
    },
    async manifest() {
      return manifest;
    },
    async content(fileId) {
      calls.push(`content:${fileId}`);
      return { ...rollbackFile, content: "# Rollback\n\nRedeploy.\n" };
    },
    ...overrides,
  };
}

async function connect(port: GatewayPort): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createBrainServer({ port, version: "test" }).connect(serverTransport);
  const client = new Client({ name: "test", version: "1" });
  await client.connect(clientTransport);
  return client;
}

describe("brain MCP server", () => {
  it("lists exactly three read-only tools", async () => {
    const client = await connect(fakePort());
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(["read_file", "related", "search_brain"]);
    expect(tools.every((tool) => tool.annotations?.readOnlyHint === true && tool.annotations.destructiveHint === false)).toBe(true);
  });

  it("searches within a sector by slug and excludes superseded documents by default", async () => {
    const port = fakePort();
    const client = await connect(port);
    const result = await client.callTool({ name: "search_brain", arguments: { query: "rollback", sector: "atlas" } });
    expect(port.calls).toEqual(["search:s1:false"]);
    expect(JSON.stringify(result.content)).toContain("[atlas] notes/rollback.md");
    expect(result.structuredContent).toMatchObject({ results: [{ sector: "atlas", fileId: "f1" }] });
  });

  it("reads and relates files by sector and path, and asks for an identifier otherwise", async () => {
    const port = fakePort();
    const client = await connect(port);
    const read = await client.callTool({ name: "read_file", arguments: { sector: "atlas", path: "notes/rollback.md" } });
    expect(read.structuredContent).toMatchObject({ sector: "atlas", path: "notes/rollback.md", version: 2, nextOffset: null });
    await client.callTool({ name: "related", arguments: { fileId: "f1" } });
    expect(port.calls).toEqual(["content:f1", "related:f1"]);
    const missing = await client.callTool({ name: "read_file", arguments: {} });
    expect(missing.isError).toBe(true);
    const unknown = await client.callTool({ name: "related", arguments: { sector: "orion", path: "x.md" } });
    expect(JSON.stringify(unknown.content)).toContain("cannot read a sector called orion");
  });

  it("turns a rejected token into an error result that names cortex login", async () => {
    const failing = async (): Promise<never> => {
      throw new CliError("invalid", exitCodes.auth, "token_invalid");
    };
    const client = await connect(fakePort({ search: failing, manifest: failing }));
    const result = await client.callTool({ name: "search_brain", arguments: { query: "rollback" } });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("cortex login");
  });
});
