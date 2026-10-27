import GithubSlugger from "github-slugger";
import type { ChunkMetadata, ChunkStatus, DocumentStatus, FileKind } from "@cortex/core";
import type { SearchResult } from "./search-types";
import { similarityFromDistance } from "./vectors";

export type RankedChunk = ChunkMetadata & { $id: string; distance: number };

export interface FileRowSummary {
  hash: string;
  title: string;
  path: string;
  kind: FileKind;
  sectorId: string;
  docId: string | null;
  status: DocumentStatus | null;
}

export interface SectorSummary {
  name: string;
  color: string;
}

const snippetLength = 200;
const fallbackSector: SectorSummary = { name: "Unknown sector", color: "#857d6f" };

export function headingAnchor(heading: string): string {
  const last = heading.split(" > ").pop() ?? heading;
  return new GithubSlugger().slug(last);
}

export function snippetOf(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= snippetLength) return collapsed;
  const cut = collapsed.slice(0, snippetLength);
  const boundary = cut.lastIndexOf(" ");
  return `${(boundary > snippetLength / 2 ? cut.slice(0, boundary) : cut).trimEnd()}...`;
}

export function shapeResults(chunks: RankedChunk[], files: Map<string, FileRowSummary>, sectors: Map<string, SectorSummary>, limit: number, perFile = 2): SearchResult[] {
  const ordered = [...chunks].sort((a, b) => a.distance - b.distance);
  const perFileCount = new Map<string, number>();
  const results: SearchResult[] = [];
  for (const chunk of ordered) {
    const file = files.get(chunk.fileId);
    if (file === undefined) continue;
    const count = perFileCount.get(chunk.fileId) ?? 0;
    if (count >= perFile) continue;
    perFileCount.set(chunk.fileId, count + 1);
    const sector = sectors.get(chunk.sectorId) ?? fallbackSector;
    const status: ChunkStatus = file.status ?? "active";
    results.push({
      chunkId: chunk.$id,
      sectorId: chunk.sectorId,
      sectorName: sector.name,
      sectorColor: sector.color,
      fileId: chunk.fileId,
      path: file.path,
      title: file.title,
      kind: file.kind,
      heading: chunk.heading,
      anchor: headingAnchor(chunk.heading),
      snippet: snippetOf(chunk.text),
      similarity: similarityFromDistance(chunk.distance),
      docId: file.docId === "" ? null : file.docId,
      status,
    });
    if (results.length >= limit) break;
  }
  return results;
}
