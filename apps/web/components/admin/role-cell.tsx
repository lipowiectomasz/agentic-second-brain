"use client";

import { useOptimistic, useState, useTransition } from "react";
import type { SectorRole } from "@cortex/core";
import { setRoleAction } from "@/app/(app)/admin/access/actions";

type CellValue = SectorRole | "none";

export function RoleCell({ userId, sectorId, sectorName, userName, role }: { userId: string; sectorId: string; sectorName: string; userName: string; role: SectorRole | null }) {
  const [value, setValue] = useState<CellValue>(role ?? "none");
  const [optimistic, setOptimistic] = useOptimistic(value);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(next: CellValue) {
    setError(null);
    startTransition(async () => {
      setOptimistic(next);
      const result = await setRoleAction({ userId, sectorId, role: next === "none" ? null : next });
      if (result.ok) setValue(next);
      else setError(result.message);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        aria-label={`${userName} in ${sectorName}`}
        value={optimistic}
        disabled={pending}
        onChange={(event) => change(event.target.value as CellValue)}
        className="rounded border px-2 py-1 text-sm"
      >
        <option value="none">None</option>
        <option value="reader">Reader</option>
        <option value="maintainer">Maintainer</option>
      </select>
      {error !== null && (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}
