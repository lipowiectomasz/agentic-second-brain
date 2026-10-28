"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { sectorColorVar } from "@cortex/core/sector-colors";
import type { BrainGraph } from "@cortex/knowledge/graph-types";
import { Icon } from "@/components/ui/icon";
import { edgePath, isolatedIds, layoutGraph, viewHeight, viewWidth, visibleEdges } from "@/lib/map-layout";

const defaultThreshold = 0.62;

function sectorFill(color: string, kind: "spine" | "project"): string {
  return kind === "spine" ? "var(--color-spine)" : sectorColorVar(color);
}

export function BrainMap({ graph }: { graph: BrainGraph }) {
  const router = useRouter();
  const [threshold, setThreshold] = useState(defaultThreshold);
  const [hovered, setHovered] = useState<string | null>(null);
  const layout = useMemo(() => layoutGraph(graph), [graph]);
  const positions = useMemo(() => new Map(layout.nodes.map((node) => [node.id, node])), [layout]);
  const sectorById = useMemo(() => new Map(layout.sectors.map((sector) => [sector.id, sector])), [layout]);
  const edges = useMemo(() => visibleEdges(graph.edges, threshold), [graph.edges, threshold]);
  const isolated = useMemo(() => isolatedIds(layout.nodes, edges), [layout.nodes, edges]);
  const tiers = useMemo(() => {
    const path = (list: typeof edges, shift = 0) =>
      list
        .map((edge) => edgePath(edge, positions, shift))
        .filter((entry) => entry !== null)
        .join(" ");
    const passive = edges.filter((edge) => edge.source !== hovered && edge.target !== hovered);
    const active = edges.filter((edge) => edge.source === hovered || edge.target === hovered);
    return {
      weak: path(passive.filter((edge) => edge.weight < 0.6)),
      mid: path(passive.filter((edge) => edge.weight >= 0.6 && edge.weight < 0.75)),
      strong: path(passive.filter((edge) => edge.weight >= 0.75)),
      shadow: path(passive, 1.5),
      active: path(active),
      activeShadow: path(active, 1.5),
    };
  }, [edges, positions, hovered]);
  const hoveredNode = hovered === null ? undefined : positions.get(hovered);
  const hoveredLinks = hovered === null ? [] : edges.filter((edge) => edge.source === hovered || edge.target === hovered);
  const crossSector = hoveredLinks.filter((edge) => positions.get(edge.source)?.sectorId !== positions.get(edge.target)?.sectorId).length;
  const projectCount = graph.sectors.filter((sector) => sector.kind === "project").length;

  return (
    <>
      <div className="pointer-events-none absolute top-5 left-6 z-[3] flex flex-col gap-0.5">
        <h1 className="serif text-[30px] leading-9 tracking-[-0.02em]">Brain map</h1>
        <p className="folio text-[11px]">
          Fig. 1 · Spine + {projectCount} {projectCount === 1 ? "sector" : "sectors"} · {graph.files.length} files
        </p>
      </div>
      <div className="map-stage">
        <svg viewBox={`0 0 ${viewWidth} ${viewHeight}`} width="100%" height="100%" role="img" aria-label="Map of connected files. A text list follows." className="block overflow-visible">
          <circle cx={600} cy={385} r={150} fill="none" style={{ stroke: "var(--border)" }} strokeWidth={1} strokeDasharray="2 7" />
          <path d={tiers.weak} fill="none" style={{ stroke: "var(--color-edge)" }} strokeWidth={1.1} strokeLinecap="round" />
          <path d={tiers.mid} fill="none" style={{ stroke: "var(--color-edge)" }} strokeWidth={1.6} strokeLinecap="round" />
          <path d={tiers.strong} fill="none" style={{ stroke: "var(--color-edge)" }} strokeWidth={2.3} strokeLinecap="round" />
          <path d={tiers.shadow} fill="none" style={{ stroke: "var(--color-edge)" }} strokeWidth={0.7} strokeLinecap="round" opacity={0.55} />
          <g className="edge-pulse">
            <path d={tiers.active} fill="none" style={{ stroke: "var(--color-edge-active)" }} strokeWidth={2.2} strokeLinecap="round" />
            <path d={tiers.activeShadow} fill="none" style={{ stroke: "var(--color-edge-active)" }} strokeWidth={0.9} strokeLinecap="round" opacity={0.5} />
          </g>
          {layout.nodes.map((node) => {
            const sector = sectorById.get(node.sectorId);
            const color = sector === undefined ? "var(--color-locked)" : sectorFill(sector.color, sector.kind);
            const lonely = isolated.has(node.id);
            return (
              <a
                key={node.id}
                href={`/files/${node.id}`}
                aria-label={`${node.title}, ${sector?.name ?? "sector"}`}
                onClick={(event) => {
                  event.preventDefault();
                  router.push(`/files/${node.id}`);
                }}
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(node.id)}
                onBlur={() => setHovered(null)}
                className="cursor-pointer outline-none"
              >
                <circle cx={node.x} cy={node.y} r={14} fill="transparent" />
                {lonely ? <circle cx={node.x} cy={node.y} r={6.5} style={{ fill: "var(--surface)", stroke: color }} strokeWidth={1.6} strokeDasharray="2.6 2" /> : <circle cx={node.x} cy={node.y} r={7} style={{ fill: color }} />}
                {hovered === node.id && <circle cx={node.x} cy={node.y} r={13} fill="none" style={{ stroke: "var(--accent)" }} strokeWidth={2} />}
              </a>
            );
          })}
          {layout.sectors.map((sector) =>
            sector.kind === "spine" ? (
              <g key={sector.id}>
                <circle cx={sector.x} cy={sector.y} r={27} style={{ fill: "var(--color-spine)" }} />
                <circle cx={sector.x} cy={sector.y} r={21} fill="none" style={{ stroke: "var(--background)" }} strokeWidth={1.2} />
                <text x={sector.x} y={sector.y + 5} textAnchor="middle" style={{ fill: "var(--background)", font: "italic 500 15px var(--font-serif)" }}>
                  Spine
                </text>
              </g>
            ) : sector.locked ? (
              <g key={sector.id}>
                <circle cx={sector.x} cy={sector.y} r={28} style={{ fill: "var(--color-locked)" }} opacity={0.9} />
                <circle cx={sector.x} cy={sector.y} r={40} fill="none" style={{ stroke: "var(--color-locked)" }} strokeWidth={1.2} strokeDasharray="3 5" />
                <rect x={sector.x - 9} y={sector.y - 1} width={18} height={13} rx={2} style={{ fill: "var(--background)" }} />
                <path d={`M${sector.x - 5.5} ${sector.y - 1}v-4a5.5 5.5 0 0 1 11 0v4`} fill="none" style={{ stroke: "var(--background)" }} strokeWidth={2.2} />
                <text x={sector.x} y={sector.labelY} textAnchor="middle" style={{ fill: "var(--muted-foreground)", font: "italic 500 22px var(--font-serif)" }}>
                  {sector.name}
                </text>
              </g>
            ) : (
              <g key={sector.id}>
                <text x={sector.x} y={sector.labelY} textAnchor="middle" style={{ fill: sectorColorVar(sector.color), font: "italic 500 22px var(--font-serif)" }}>
                  {sector.name}
                </text>
                <text x={sector.x} y={sector.labelY + 18} textAnchor="middle" style={{ fill: "var(--muted-foreground)", font: "500 11px var(--font-mono)", letterSpacing: "0.06em" }}>
                  {sector.fileCount} {sector.fileCount === 1 ? "FILE" : "FILES"}
                </text>
              </g>
            ),
          )}
        </svg>
        {layout.sectors
          .filter((sector) => sector.locked)
          .map((sector) => (
            <Link
              key={sector.id}
              href={`/sectors#sector-${sector.id}`}
              className="btn btn-secondary btn-sm absolute z-[2] -translate-x-1/2 shadow-sm"
              style={{ left: `${(sector.x / viewWidth) * 100}%`, top: `${((sector.y + 52) / viewHeight) * 100}%` }}
              aria-label={`Request access to ${sector.name}`}
            >
              <Icon name="lock" size={14} />
              Request access
            </Link>
          ))}
        {hoveredNode !== undefined && (
          <div
            className="raised pointer-events-none absolute z-[3] flex w-[290px] flex-col gap-1.5 rounded-md px-3.5 py-3"
            style={{ left: `calc(${(hoveredNode.x / viewWidth) * 100}% + 22px)`, top: `calc(${(hoveredNode.y / viewHeight) * 100}% - 34px)` } as CSSProperties}
            role="status"
          >
            <span className="serif text-[17px] leading-[22px]">{hoveredNode.title}</span>
            <span className="small muted">{sectorById.get(hoveredNode.sectorId)?.name}</span>
            <span className="mono text-[11.5px] leading-4 text-muted-foreground">{hoveredNode.path}</span>
            <span className="xsmall" style={{ color: "var(--accent)" }}>
              {hoveredLinks.length} {hoveredLinks.length === 1 ? "link" : "links"}
              {crossSector > 0 ? ` · ${crossSector} to other sectors` : ""}
            </span>
          </div>
        )}
      </div>
      <details className="map-panel card shadow-md" open>
        <summary className="flex min-h-12 items-center justify-between gap-2 px-4 py-3">
          <span className="flex items-baseline gap-2.5">
            <span className="label">Similarity</span>
            <span className="mono text-sm font-medium">{threshold.toFixed(2)}</span>
            <span className="xsmall muted" data-testid="edge-count">
              {edges.length} links
            </span>
          </span>
          <span className="chev muted">▾</span>
        </summary>
        <div className="flex flex-col gap-3.5 px-4 pb-4">
          <div className="flex flex-col gap-1">
            <div className="ruler">
              <input
                className="range w-full"
                type="range"
                min={0.45}
                max={0.9}
                step={0.01}
                value={threshold}
                onChange={(event) => setThreshold(Number(event.target.value))}
                aria-label="Similarity threshold"
                aria-valuetext={threshold.toFixed(2)}
              />
            </div>
            <div className="flex justify-between">
              <span className="mono xsmall muted">0.45 more links</span>
              <span className="mono xsmall muted">0.90 fewer</span>
            </div>
          </div>
          {!graph.linksAvailable && <p className="xsmall" style={{ color: "var(--warning)" }}>Similarity links are unavailable right now.</p>}
          <hr className="rule" />
          <div className="grid grid-cols-2 gap-x-3 gap-y-2" aria-label="Legend">
            <span className="xsmall flex items-center gap-2">
              <svg width="18" height="18" aria-hidden><circle cx="9" cy="9" r="7" style={{ fill: "var(--color-spine)" }} /></svg>Spine
            </span>
            <span className="xsmall flex items-center gap-2">
              <span className="serif w-[18px] text-center text-sm italic" style={{ color: "var(--sector-2)" }}>
                Aa
              </span>
              Sector
            </span>
            <span className="xsmall flex items-center gap-2">
              <svg width="18" height="18" aria-hidden><circle cx="9" cy="9" r="5" style={{ fill: "var(--sector-1)" }} /></svg>File
            </span>
            <span className="xsmall flex items-center gap-2">
              <svg width="18" height="18" aria-hidden><circle cx="9" cy="9" r="5" style={{ fill: "var(--surface)", stroke: "var(--sector-1)" }} strokeWidth="1.6" strokeDasharray="2.6 2" /></svg>Isolated
            </span>
            <span className="xsmall flex items-center gap-2">
              <svg width="18" height="18" aria-hidden><circle cx="9" cy="9" r="6" style={{ fill: "var(--color-locked)" }} /></svg>No access
            </span>
            <span className="xsmall flex items-center gap-2">
              <svg width="18" height="18" aria-hidden><path d="M2 13 Q9 3 16 9" fill="none" style={{ stroke: "var(--color-edge-active)" }} strokeWidth="2" /></svg>Similar
            </span>
          </div>
        </div>
      </details>
      <section className="sr-only" aria-label="Files on this map">
        <h2>Files on this map</h2>
        <ul>
          {layout.nodes.map((node) => (
            <li key={node.id}>
              <Link href={`/files/${node.id}`}>
                {node.title} - {sectorById.get(node.sectorId)?.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
