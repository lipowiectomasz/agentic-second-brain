"use client";

import { fileKinds } from "@cortex/core/file-kind";

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

export function FilterChips({ sectors, filters, onChange }: { sectors: PaletteSector[]; filters: Filters; onChange: (filters: Filters) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {sectors.map((sector) => (
        <button
          key={sector.id}
          type="button"
          aria-pressed={filters.sectorIds.includes(sector.id)}
          onClick={() => onChange({ ...filters, sectorIds: toggle(filters.sectorIds, sector.id) })}
          className="flex items-center gap-1 rounded-full border px-2 py-0.5 aria-pressed:bg-neutral-900 aria-pressed:text-white"
        >
          <span aria-hidden className="inline-block size-2 rounded-full" style={{ backgroundColor: sector.color }} />
          {sector.name}
        </button>
      ))}
      {fileKinds.map((kind) => (
        <button
          key={kind}
          type="button"
          aria-pressed={filters.kinds.includes(kind)}
          onClick={() => onChange({ ...filters, kinds: toggle(filters.kinds, kind) })}
          className="rounded-full border px-2 py-0.5 aria-pressed:bg-neutral-900 aria-pressed:text-white"
        >
          {kind}
        </button>
      ))}
      <label className="ml-auto flex items-center gap-1">
        <input type="checkbox" checked={filters.includeSuperseded} onChange={(event) => onChange({ ...filters, includeSuperseded: event.target.checked })} />
        Include superseded
      </label>
    </div>
  );
}
