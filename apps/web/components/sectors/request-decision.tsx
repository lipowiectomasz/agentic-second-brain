"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { decideRequestAction } from "@/app/(app)/requests/actions";

export function RequestDecision({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(decideRequestAction, null);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <button type="submit" name="decision" value="approve" disabled={pending} className="btn btn-primary btn-sm">
        Approve
      </button>
      <button type="submit" name="decision" value="reject" disabled={pending} className="btn btn-secondary btn-sm">
        Reject
      </button>
      {state?.ok === false && (
        <span role="alert" className="err">
          {state.message}
        </span>
      )}
    </form>
  );
}
