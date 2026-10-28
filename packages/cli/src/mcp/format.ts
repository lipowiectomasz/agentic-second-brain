import type { ManifestData, SearchHit } from "@cortex/gateway-contract";
import type { Hit } from "./schemas";

export const pageSize = 48_000;

export function sectorSlugs(manifest: ManifestData | null): Map<string, string> {
  return new Map((manifest?.sectors ?? []).map((sector) => [sector.id, sector.slug]));
}

export function toHits(hits: SearchHit[], slugs: Map<string, string>): Hit[] {
  return hits.map((hit) => ({
    sector: slugs.get(hit.sectorId) ?? hit.sectorId,
    path: hit.path,
    heading: hit.heading,
    similarity: Math.round(hit.similarity * 100) / 100,
    snippet: hit.snippet,
    fileId: hit.fileId,
    docId: hit.docId,
    status: hit.status === "active" ? null : hit.status,
  }));
}

export function formatHits(hits: Hit[]): { text: string; structured: { results: Hit[] } } {
  if (hits.length === 0) return { text: "No matching knowledge. Try describing the problem in other words.", structured: { results: [] } };
  const lines = hits.map((hit, index) => {
    const doc = hit.docId === null ? "" : ` [${hit.docId}${hit.status === null ? "" : ` ${hit.status}`}]`;
    return `${index + 1}. [${hit.sector}] ${hit.path} > ${hit.heading}${doc} (similarity ${hit.similarity.toFixed(2)})\n   ${hit.snippet}\n   fileId: ${hit.fileId}`;
  });
  return { text: lines.join("\n"), structured: { results: hits } };
}

export function pageContent(content: string, offset: number, size = pageSize): { slice: string; nextOffset: number | null } {
  if (offset >= content.length) return { slice: "", nextOffset: null };
  let end = Math.min(offset + size, content.length);
  if (end < content.length) {
    const newline = content.lastIndexOf("\n", end);
    if (newline > offset) end = newline + 1;
  }
  return { slice: content.slice(offset, end), nextOffset: end < content.length ? end : null };
}
