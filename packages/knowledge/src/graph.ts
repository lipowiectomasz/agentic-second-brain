import type { BrainGraph, GraphEdge, GraphFile, GraphSector } from "./graph-types";

export interface GraphOptions {
  floor: number;
  maxEdgesPerFile: number;
}

export const defaultGraphOptions: GraphOptions = { floor: 0.45, maxEdgesPerFile: 6 };

function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let index = 0; index < a.length; index += 1) sum += (a[index] ?? 0) * (b[index] ?? 0);
  return sum;
}

export function buildBrainGraph(input: {
  sectors: Array<Omit<GraphSector, "locked">>;
  readableSectorIds: Set<string>;
  files: GraphFile[];
  vectors: Map<string, number[]>;
  options?: GraphOptions;
  linksAvailable?: boolean;
  now: Date;
}): BrainGraph {
  const options = input.options ?? defaultGraphOptions;
  const files = [...input.files].sort((a, b) => a.id.localeCompare(b.id));
  const candidates: GraphEdge[] = [];
  for (let i = 0; i < files.length; i += 1) {
    const left = files[i] as GraphFile;
    const a = input.vectors.get(left.id);
    if (a === undefined) continue;
    for (let j = i + 1; j < files.length; j += 1) {
      const right = files[j] as GraphFile;
      const b = input.vectors.get(right.id);
      if (b === undefined) continue;
      const weight = Math.round(dot(a, b) * 1000) / 1000;
      if (weight >= options.floor) candidates.push({ source: left.id, target: right.id, weight });
    }
  }
  const kept = new Set<GraphEdge>();
  for (const file of files) {
    candidates
      .filter((edge) => edge.source === file.id || edge.target === file.id)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, options.maxEdgesPerFile)
      .forEach((edge) => kept.add(edge));
  }
  return {
    sectors: input.sectors.map((sector) => ({ ...sector, locked: sector.kind !== "spine" && !input.readableSectorIds.has(sector.id) })),
    files,
    edges: [...kept].sort((a, b) => b.weight - a.weight),
    floor: options.floor,
    linksAvailable: input.linksAvailable ?? true,
    generatedAt: input.now.toISOString(),
  };
}
