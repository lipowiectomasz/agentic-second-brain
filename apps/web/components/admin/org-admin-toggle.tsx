"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setOrgAdminAction } from "@/app/(app)/admin/access/actions";

export function OrgAdminToggle({ userId, userName, isAdmin }: { userId: string; userName: string; isAdmin: boolean }) {
  const [value, setValue] = useState(isAdmin);
  const [optimistic, setOptimistic] = useOptimistic(value);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(next: boolean) {
    setError(null);
    startTransition(async () => {
      setOptimistic(next);
      const result = await setOrgAdminAction({ userId, isAdmin: next });
      if (result.ok) setValue(next);
      else setError(result.message);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <input type="checkbox" role="switch" aria-label={`${userName} is organisation admin`} checked={optimistic} disabled={pending} onChange={(event) => toggle(event.target.checked)} />
      {error !== null && (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}
