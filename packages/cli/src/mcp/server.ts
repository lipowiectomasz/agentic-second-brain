import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { validateSyncPath } from "@cortex/core/sync-path";
import { errorResult, toToolError } from "./errors";
import { formatHits, pageContent, sectorSlugs, toHits } from "./format";
import type { GatewayPort } from "./gateway-port";
import { fileOutput, hitsOutput, readFileInput, relatedInput, searchBrainInput } from "./schemas";

const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

const descriptions = {
  search_brain:
    "Search the team's shared knowledge (standards, procedures, specs, findings, notes) by meaning. Returns the closest passages with sector, file path, heading, document ID, status and similarity. Superseded and deprecated documents are excluded unless includeSuperseded is true; when a hit names a superseding document, prefer that one. Use before solving a problem that the team may have met before.",
  related: "Find knowledge related to one brain file across every sector you can read, excluding the file itself. Identify the file by fileId from a search hit, or by sector and path.",
  read_file: "Read the full Markdown of a brain file named in a search hit. Long files are returned in pages; call again with nextOffset to continue.",
};

async function resolveFileId(port: GatewayPort, input: { fileId?: string | undefined; sector?: string | undefined; path?: string | undefined }): Promise<string | CallToolResult> {
  if (input.fileId !== undefined) return input.fileId;
  if (input.sector === undefined || input.path === undefined) return errorResult("Name the file by fileId, or by both sector and path.");
  const manifest = await port.manifest();
  const sector = manifest.sectors.find((entry) => entry.slug === input.sector);
  if (sector === undefined) return errorResult(`You cannot read a sector called ${input.sector}.`);
  if (!validateSyncPath(input.path, sector.kind).ok) return errorResult("That is not a valid brain file path.");
  const file = manifest.files.find((entry) => entry.sectorId === sector.id && entry.path === input.path);
  return file?.fileId ?? errorResult("No readable file matches. It may have been deleted or you may have lost access.");
}

async function guarded(run: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await run();
  } catch (error) {
    return toToolError(error);
  }
}

async function slugs(port: GatewayPort): Promise<Map<string, string>> {
  return sectorSlugs(await port.manifest().catch(() => null));
}

export function createBrainServer(deps: { port: GatewayPort; version: string }): McpServer {
  const { port } = deps;
  const server = new McpServer({ name: "cortex", version: deps.version });

  server.registerTool("search_brain", { title: "Search the team brain", description: descriptions.search_brain, inputSchema: searchBrainInput, outputSchema: hitsOutput, annotations }, (input) =>
    guarded(async () => {
      const known = await slugs(port);
      const sectorId = input.sector === undefined ? undefined : [...known.entries()].find(([, slug]) => slug === input.sector)?.[0];
      if (input.sector !== undefined && sectorId === undefined) return errorResult(`You cannot read a sector called ${input.sector}.`);
      const hits = await port.search({ query: input.query, includeSuperseded: input.includeSuperseded, limit: input.limit, ...(sectorId === undefined ? {} : { sectorIds: [sectorId] }), ...(input.kind === undefined ? {} : { kinds: [input.kind] }) });
      const formatted = formatHits(toHits(hits, known));
      return { content: [{ type: "text", text: formatted.text }], structuredContent: formatted.structured };
    }),
  );

  server.registerTool("related", { title: "Find related knowledge", description: descriptions.related, inputSchema: relatedInput, outputSchema: hitsOutput, annotations }, (input) =>
    guarded(async () => {
      const fileId = await resolveFileId(port, input);
      if (typeof fileId !== "string") return fileId;
      const formatted = formatHits(toHits(await port.related({ fileId, limit: input.limit }), await slugs(port)));
      return { content: [{ type: "text", text: formatted.text }], structuredContent: formatted.structured };
    }),
  );

  server.registerTool("read_file", { title: "Read a brain file", description: descriptions.read_file, inputSchema: readFileInput, outputSchema: fileOutput, annotations }, (input) =>
    guarded(async () => {
      const fileId = await resolveFileId(port, input);
      if (typeof fileId !== "string") return fileId;
      const file = await port.content(fileId);
      const page = pageContent(file.content, input.offset);
      const sector = (await slugs(port)).get(file.sectorId) ?? file.sectorId;
      const structured = { sector, path: file.path, version: file.version, content: page.slice, offset: input.offset, nextOffset: page.nextOffset, totalLength: file.content.length };
      const footer = page.nextOffset === null ? "" : `\n\n[continues: call read_file again with offset ${page.nextOffset}]`;
      return { content: [{ type: "text", text: `[${sector}] ${file.path} (v${file.version})\n\n${page.slice}${footer}` }], structuredContent: structured };
    }),
  );

  return server;
}
