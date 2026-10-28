"use client";

import { useActionState, useRef } from "react";
import { acceptProposalAction, rejectProposalAction } from "@/app/(app)/admin/proposals/actions";
import type { ActionResult } from "@/lib/action-result";

export function ReviewActions({ proposalId }: { proposalId: string }) {
  const [accepted, accept, accepting] = useActionState<ActionResult | null, FormData>(acceptProposalAction, null);
  const [rejected, reject, rejecting] = useActionState<ActionResult | null, FormData>(rejectProposalAction, null);
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <div className="action-bar card p-4">
      <p className="folio">Decision</p>
      <form action={accept}>
        <input type="hidden" name="proposalId" value={proposalId} />
        <button type="submit" className="btn btn-primary w-full" disabled={accepting}>
          {accepting && <span className="spinner" aria-hidden />}
          Accept
        </button>
      </form>
      <button type="button" className="btn btn-destructive w-full" onClick={() => dialog.current?.showModal()}>
        Reject
      </button>
      {accepted?.ok === false && <p className="err">{accepted.message}</p>}
      <dialog ref={dialog} aria-labelledby="reject-title" className="dialog m-auto w-[min(480px,calc(100%-32px))] p-6 text-foreground backdrop:bg-[var(--scrim)]">
        <form action={reject} className="flex flex-col gap-3">
          <input type="hidden" name="proposalId" value={proposalId} />
          <h2 id="reject-title" className="serif text-2xl">
            Reject proposal
          </h2>
          <div className="field">
            <label className="label" htmlFor="reject-note">
              Tell the author why
            </label>
            <textarea id="reject-note" name="note" className="input min-h-28" required minLength={1} maxLength={1000} />
          </div>
          {rejected?.ok === false && <p className="err">{rejected.message}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => dialog.current?.close()}>
              Cancel
            </button>
            <button type="submit" className="btn btn-destructive-solid" disabled={rejecting}>
              Reject
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
