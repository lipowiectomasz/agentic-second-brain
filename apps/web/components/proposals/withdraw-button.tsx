"use client";

import { useActionState } from "react";
import { withdrawProposalAction } from "@/app/(app)/proposals/actions";
import { ConfirmPopover } from "@/components/ui/confirm-popover";
import type { ActionResult } from "@/lib/action-result";

export function WithdrawButton({ proposalId }: { proposalId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(withdrawProposalAction, null);
  return (
    <>
      <ConfirmPopover
        id={`withdraw-${proposalId}`}
        triggerLabel="Withdraw"
        title="Withdraw this proposal?"
        description="It leaves the review queue. You can propose it again later."
        confirm={
          <form action={action}>
            <input type="hidden" name="proposalId" value={proposalId} />
            <button type="submit" className="btn btn-destructive btn-sm" disabled={pending}>
              Withdraw
            </button>
          </form>
        }
      />
      {state?.ok === false && <span className="err">{state.message}</span>}
    </>
  );
}
