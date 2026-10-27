export function SectorSwatch({ color, locked = false }: { color: string; locked?: boolean }) {
  return <span aria-hidden className="inline-block size-3 rounded-full" style={{ backgroundColor: locked ? "#9a9284" : color }} />;
}
