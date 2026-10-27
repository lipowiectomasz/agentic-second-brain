"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { requestAccessAction } from "@/app/(app)/sectors/actions";

export function RequestAccessButton({ sectorId, sectorName }: { sectorId: string; sectorName: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(requestAccessAction, null);
  return (
    <details>
      <summary className="cursor-pointer text-sm underline">Request access</summary>
      <form action={action} className="mt-2 flex flex-col gap-2">
        <input type="hidden" name="sectorId" value={sectorId} />
        <label className="flex flex-col gap-1 text-sm">
          Role in {sectorName}
          <select name="role" defaultValue="reader" className="rounded border px-2 py-1">
            <option value="reader">Reader</option>
            <option value="maintainer">Maintainer</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Message (optional)
          <textarea name="message" maxLength={280} rows={2} className="rounded border px-2 py-1" />
        </label>
        {state?.ok === false && (
          <p role="alert" className="text-sm text-red-700">
            {state.message}
          </p>
        )}
        <button type="submit" disabled={pending} className="w-fit rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-60">
          Send request
        </button>
      </form>
    </details>
  );
}
