import type { CSSProperties } from "react";
import { sectorColorVar } from "@cortex/core/sector-colors";

export function sectorStyle(color: string): CSSProperties {
  return { "--c": sectorColorVar(color) } as CSSProperties;
}

export function SectorBadge({ name, color, locked = false }: { name: string; color: string; locked?: boolean }) {
  if (locked) return <span className="badge badge-locked">{name}</span>;
  return (
    <span className="badge badge-sector" style={sectorStyle(color)}>
      <span aria-hidden className="dot" />
      {name}
    </span>
  );
}
