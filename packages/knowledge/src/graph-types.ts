import type { FileKind } from "@cortex/core";

export interface GraphSector {
  id: string;
  name: string;
  color: string;
  kind: "spine" | "project";
  locked: boolean;
}

export interface GraphFile {
  id: string;
  sectorId: string;
  title: string;
  path: string;
  kind: FileKind;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

export interface BrainGraph {
  sectors: GraphSector[];
  files: GraphFile[];
  edges: GraphEdge[];
  floor: number;
  linksAvailable: boolean;
  generatedAt: string;
}
