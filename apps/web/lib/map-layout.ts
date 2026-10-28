import type { BrainGraph, GraphEdge } from "@cortex/knowledge/graph-types";

export const viewWidth = 1200;
export const viewHeight = 760;
const centre = { x: 600, y: 385 };
const golden = Math.PI * (3 - Math.sqrt(5));

export interface PlacedNode {
  id: string;
  sectorId: string;
  title: string;
  path: string;
  x: number;
  y: number;
}

export interface PlacedSector {
  id: string;
  name: string;
  color: string;
  kind: "spine" | "project";
  locked: boolean;
  x: number;
  y: number;
  labelY: number;
  fileCount: number;
}

export interface MapLayout {
  nodes: PlacedNode[];
  sectors: PlacedSector[];
}

function spiral(count: number, startRadius: number, spacing: number, origin: { x: number; y: number }, offset: number): Array<{ x: number; y: number }> {
  return Array.from({ length: count }, (_, index) => {
    const radius = startRadius + spacing * Math.sqrt(index + 0.5);
    const angle = index * golden + offset;
    return { x: Math.round(origin.x + radius * Math.cos(angle)), y: Math.round(origin.y + radius * Math.sin(angle)) };
  });
}

export function layoutGraph(graph: BrainGraph): MapLayout {
  const spine = graph.sectors.find((sector) => sector.kind === "spine");
  const projects = graph.sectors.filter((sector) => sector.kind === "project").sort((a, b) => Number(a.locked) - Number(b.locked) || a.name.localeCompare(b.name));
  const nodes: PlacedNode[] = [];
  const sectors: PlacedSector[] = [];
  const byFileSector = (sectorId: string) => graph.files.filter((file) => file.sectorId === sectorId).sort((a, b) => a.path.localeCompare(b.path));

  if (spine !== undefined) {
    const files = byFileSector(spine.id);
    spiral(files.length, 52, 22, centre, 0).forEach((point, index) => {
      const file = files[index];
      if (file !== undefined) nodes.push({ id: file.id, sectorId: file.sectorId, title: file.title, path: file.path, ...point });
    });
    sectors.push({ ...spine, ...centre, labelY: centre.y, fileCount: files.length });
  }

  projects.forEach((sector, index) => {
    const angle = -Math.PI * 0.8 + (index * 2 * Math.PI) / Math.max(projects.length, 1);
    const anchor = { x: Math.round(centre.x + 400 * Math.cos(angle)), y: Math.round(centre.y + 245 * Math.sin(angle)) };
    const files = sector.locked ? [] : byFileSector(sector.id);
    const points = spiral(files.length, 12, 30, anchor, index);
    points.forEach((point, position) => {
      const file = files[position];
      if (file !== undefined) nodes.push({ id: file.id, sectorId: file.sectorId, title: file.title, path: file.path, ...point });
    });
    const radius = files.length === 0 ? 40 : 12 + 30 * Math.sqrt(files.length);
    sectors.push({ ...sector, ...anchor, labelY: Math.max(30, anchor.y - radius - 26), fileCount: files.length });
  });
  return { nodes, sectors };
}

function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) value = Math.imul(value ^ text.charCodeAt(index), 16777619);
  return value >>> 0;
}

export function edgePath(edge: GraphEdge, positions: Map<string, { x: number; y: number }>, shift = 0): string | null {
  const a = positions.get(edge.source);
  const b = positions.get(edge.target);
  if (a === undefined || b === undefined) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const seed = hash(`${edge.source}|${edge.target}`);
  const bend = (0.06 + (seed % 4) * 0.01) * (seed % 2 === 0 ? 1 : -1) * length;
  const nx = -dy / length;
  const ny = dx / length;
  const cx = (a.x + b.x) / 2 + nx * bend;
  const cy = (a.y + b.y) / 2 + ny * bend;
  return `M${a.x + nx * shift} ${a.y + ny * shift} Q${Math.round(cx + nx * shift)} ${Math.round(cy + ny * shift)} ${b.x + nx * shift} ${b.y + ny * shift}`;
}

export function visibleEdges(edges: GraphEdge[], threshold: number): GraphEdge[] {
  return edges.filter((edge) => edge.weight >= threshold);
}

export function isolatedIds(nodes: Array<{ id: string }>, edges: GraphEdge[]): Set<string> {
  const linked = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
  return new Set(nodes.map((node) => node.id).filter((id) => !linked.has(id)));
}
