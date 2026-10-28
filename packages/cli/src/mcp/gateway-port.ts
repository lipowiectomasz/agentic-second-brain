import type { FileKind } from "@cortex/core/file-kind";
import type { FileEntry, ManifestData, SearchHit } from "@cortex/gateway-contract";
import type { GatewayClient } from "../gateway-client";

export interface GatewayPort {
  search(input: { query: string; sectorIds?: string[]; kinds?: FileKind[]; includeSuperseded: boolean; limit: number }): Promise<SearchHit[]>;
  related(input: { fileId: string; limit: number }): Promise<SearchHit[]>;
  manifest(): Promise<ManifestData>;
  content(fileId: string): Promise<FileEntry & { content: string }>;
}

const manifestTtlMs = 60_000;

export function gatewayPort(client: GatewayClient, now: () => number = Date.now): GatewayPort {
  let cached: { at: number; data: ManifestData } | null = null;
  return {
    async search(input) {
      return (await client.call("search", input)).results;
    },
    async related(input) {
      return (await client.call("related", input)).results;
    },
    async manifest() {
      if (cached !== null && now() - cached.at < manifestTtlMs) return cached.data;
      cached = { at: now(), data: await client.call("manifest", {}) };
      return cached.data;
    },
    async content(fileId) {
      return client.call("filesContent", { fileId });
    },
  };
}
