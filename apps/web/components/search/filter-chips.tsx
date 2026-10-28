"use client";

import { fileKinds } from "@cortex/core/file-kind";
import { sectorStyle } from "@/components/sectors/sector-badge";

export interface PaletteSector {
  id: string;
  name: string;
  color: string;
}

export interface Filters {
  sectorIds: string[];
  kinds: string[];
  includeSuperseded: boolean;
}

function toggle(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

function Check() {
  return (
    <svg className="check" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m3 8.5 3 3 7-7" />
    </svg>
  );
}

export function FilterChips({ sectors, filters, onChange }: { sectors: PaletteSector[]; filters: Filters; onChange: (filters: Filters) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="chip-row" role="group" aria-label="Filter by sector">
        <span className="folio w-14 flex-none self-center">Sector</span>
        {sectors.map((sector) => (
          <button
            key={sector.id}
            type="button"
            className="chip"
            aria-pressed={filters.sectorIds.includes(sector.id)}
            onClick={() => onChange({ ...filters, sectorIds: toggle(filters.sectorIds, sector.id) })}
          >
            <Check />
            <span aria-hidden className="dot" style={sectorStyle(sector.color)} />
            {sector.name}
          </button>
        ))}
      </div>
      <div className="chip-row" role="group" aria-label="Filter by kind">
        <span className="folio w-14 flex-none self-center">Kind</span>
        {fileKinds.map((kind) => (
          <button
            key={kind}
            type="button"
            className="chip mono"
            aria-pressed={filters.kinds.includes(kind)}
            onClick={() => onChange({ ...filters, kinds: toggle(filters.kinds, kind) })}
          >
            <Check />
            {kind}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="xsmall muted">Superseded and deprecated documents are hidden unless you include them.</span>
        <span className="inline-flex items-center gap-2.5">
          <span className="small" id="include-superseded-label">
            Include superseded
          </span>
          <button
            type="button"
            className="switch"
            role="switch"
            aria-checked={filters.includeSuperseded}
            aria-labelledby="include-superseded-label"
            onClick={() => onChange({ ...filters, includeSuperseded: !filters.includeSuperseded })}
          />
        </span>
      </div>
    </div>
  );
}
