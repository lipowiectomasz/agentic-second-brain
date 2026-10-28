"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { actionGroups, actionLabels } from "@/lib/audit-labels";

function Select({ id, label, value, onChange, children }: { id: string; label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <div className="field min-w-48">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="select-wrap">
        <select id={id} className="input" value={value} onChange={(event) => onChange(event.target.value)}>
          {children}
        </select>
      </div>
    </div>
  );
}

export function AuditFilters({ people, sectors }: { people: Array<{ id: string; name: string }>; sectors: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    next.delete("cursor");
    if (value === "") next.delete(key);
    else next.set(key, value);
    const query = next.toString();
    router.replace(query === "" ? pathname : `${pathname}?${query}`);
  };
  return (
    <div className="flex flex-wrap gap-4" role="group" aria-label="Filters">
      <Select id="audit-person" label="Person" value={params.get("actorId") ?? ""} onChange={(value) => set("actorId", value)}>
        <option value="">Everyone</option>
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
          </option>
        ))}
      </Select>
      <Select id="audit-sector" label="Sector" value={params.get("sectorId") ?? ""} onChange={(value) => set("sectorId", value)}>
        <option value="">All sectors</option>
        {sectors.map((sector) => (
          <option key={sector.id} value={sector.id}>
            {sector.name}
          </option>
        ))}
      </Select>
      <Select id="audit-event" label="Event" value={params.get("action") ?? ""} onChange={(value) => set("action", value)}>
        <option value="">All events</option>
        {actionGroups.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.actions.map((action) => (
              <option key={action} value={action}>
                {actionLabels[action]}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>
    </div>
  );
}
