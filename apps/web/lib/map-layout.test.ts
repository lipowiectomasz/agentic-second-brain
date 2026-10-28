import { describe, expect, it } from "vitest";
import type { BrainGraph } from "@cortex/knowledge/graph-types";
import { edgePath, isolatedIds, layoutGraph, viewHeight, viewWidth, visibleEdges } from "./map-layout";

const graph: BrainGraph = {
  sectors: [
    { id: "spine", name: "Spine", color: "#1d2a44", kind: "spine", locked: false },
    { id: "atlas", name: "Atlas", color: "#1b6a6b", kind: "project", locked: false },
    { id: "orion", name: "Orion", color: "#843a74", kind: "project", locked: true },
  ],
  files: [
    ...Array.from({ length: 10 }, (_, index) => ({ id: `s${index}`, sectorId: "spine", title: `S${index}`, path: `standards/s${index}.md`, kind: "standard" as const })),
    ...Array.from({ length: 12 }, (_, index) => ({ id: `a${index}`, sectorId: "atlas", title: `A${index}`, path: `notes/a${index}.md`, kind: "note" as const })),
  ],
  edges: [
    { source: "a0", target: "s1", weight: 0.8 },
    { source: "a1", target: "a2", weight: 0.5 },
  ],
  floor: 0.45,
  linksAvailable: true,
  generatedAt: "2026-10-28T10:00:00.000Z",
};

describe("map layout", () => {
  it("places every readable file inside the view, deterministically", () => {
    const layout = layoutGraph(graph);
    expect(layout.nodes).toHaveLength(22);
    expect(layout.nodes.every((node) => node.x > 0 && node.x < viewWidth && node.y > 0 && node.y < viewHeight)).toBe(true);
    expect(layoutGraph(graph)).toEqual(layout);
  });

  it("shows locked sectors as a single anchor without files", () => {
    const orion = layoutGraph(graph).sectors.find((sector) => sector.id === "orion");
    expect(orion).toMatchObject({ locked: true, fileCount: 0 });
  });

  it("filters edges by threshold and finds isolated files", () => {
    const layout = layoutGraph(graph);
    const visible = visibleEdges(graph.edges, 0.62);
    expect(visible).toHaveLength(1);
    expect(isolatedIds(layout.nodes, visible).has("a1")).toBe(true);
    expect(isolatedIds(layout.nodes, visible).has("a0")).toBe(false);
  });

  it("draws an edge as a stable quadratic curve", () => {
    const positions = new Map(layoutGraph(graph).nodes.map((node) => [node.id, node]));
    const path = edgePath({ source: "a0", target: "s1", weight: 0.8 }, positions);
    expect(path).toMatch(/^M\S+ \S+ Q\S+ \S+ \S+ \S+$/);
    expect(edgePath({ source: "a0", target: "s1", weight: 0.8 }, positions)).toBe(path);
    expect(edgePath({ source: "a0", target: "missing", weight: 0.8 }, positions)).toBeNull();
  });
});
