import { sectorStyle } from "./sector-badge";

export function SectorSwatch({ color, locked = false }: { color: string; locked?: boolean }) {
  return <span aria-hidden className="dot" style={locked ? { background: "var(--color-locked)" } : sectorStyle(color)} />;
}
