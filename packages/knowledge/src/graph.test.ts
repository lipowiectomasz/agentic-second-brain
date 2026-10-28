import { describe, expect, it } from "vitest";
import { buildBrainGraph } from "./graph";
import type { GraphFile } from "./graph-types";
import { normalize } from "./vectors";

const file = (id: string, sectorId = "atlas"): GraphFile => ({ id, sectorId, title: id, path: `${id}.md`, kind: "note" });
const sectors = [
  { id: "spine", name: "Spine", color: "#1d2a44", kind: "spine" as const },
  { id: "atlas", name: "Atlas", color: "#1b6a6b", kind: "project" as const },
  { id: "orion", name: "Orion", color: "#843a74", kind: "project" as const },
];
const now = new Date("2026-10-28T10:00:00Z");

describe("buildBrainGraph", () => {
  it("drops pairs below the floor, stores each edge once and keeps isolated files", () => {
    const vectors = new Map([
      ["a", normalize([1, 0, 0])],
      ["b", normalize([1, 0.2, 0])],
      ["c", normalize([0, 1, 0])],
    ]);
    const graph = buildBrainGraph({ sectors, readableSectorIds: new Set(["atlas"]), files: [file("c"), file("b"), file("a"), file("d")], vectors, now });
    expect(graph.edges).toEqual([{ source: "a", target: "b", weight: 0.981 }]);
    expect(graph.files.map((entry) => entry.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("keeps at most the strongest edges per file unless the other end keeps them", () => {
    const files = ["hub", "n1", "n2", "n3"].map((id) => file(id));
    const vectors = new Map([
      ["hub", normalize([1, 0, 0, 0])],
      ["n1", normalize([1, 0.1, 0, 0])],
      ["n2", normalize([1, 0, 0.3, 0])],
      ["n3", normalize([1, 0, 0, 0.6])],
    ]);
    const graph = buildBrainGraph({ sectors, readableSectorIds: new Set(["atlas"]), files, vectors, options: { floor: 0.45, maxEdgesPerFile: 1 }, now });
    expect(graph.edges.every((edge) => edge.source < edge.target)).toBe(true);
    expect(graph.edges.some((edge) => edge.source === "hub" && edge.target === "n1")).toBe(true);
    expect(graph.edges.length).toBeLessThan(6);
  });

  it("locks project sectors the caller cannot read and never the spine", () => {
    const graph = buildBrainGraph({ sectors, readableSectorIds: new Set(["atlas"]), files: [], vectors: new Map(), now });
    expect(graph.sectors.map((sector) => [sector.id, sector.locked])).toEqual([
      ["spine", false],
      ["atlas", false],
      ["orion", true],
    ]);
  });
});
