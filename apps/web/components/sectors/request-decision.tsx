"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { decideRequestAction } from "@/app/(app)/requests/actions";

export function RequestDecision({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(decideRequestAction, null);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <button type="submit" name="decision" value="approve" disabled={pending} className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-60">
        Approve
      </button>
      <button type="submit" name="decision" value="reject" disabled={pending} className="rounded border px-3 py-1 text-sm disabled:opacity-60">
        Reject
      </button>
      {state?.ok === false && (
        <span role="alert" className="text-sm text-red-700">
          {state.message}
        </span>
      )}
    </form>
  );
}
