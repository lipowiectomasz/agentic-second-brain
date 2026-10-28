"use client";

import { useActionState, useRef } from "react";
import { revokeTokenAction } from "@/app/(app)/settings/tokens/actions";
import type { ActionResult } from "@/lib/action-result";

export function RevokeButton({ tokenId, name, prefix }: { tokenId: string; name: string; prefix: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(revokeTokenAction, null);
  return (
    <>
      <button type="button" className="btn btn-destructive btn-sm" aria-label={`Revoke ${name}`} onClick={() => dialog.current?.showModal()}>
        Revoke
      </button>
      <dialog ref={dialog} role="alertdialog" aria-labelledby={`revoke-${tokenId}`} className="dialog m-auto w-[min(440px,calc(100%-32px))] p-6 text-left text-foreground backdrop:bg-[var(--scrim)]">
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="tokenId" value={tokenId} />
          <h2 id={`revoke-${tokenId}`} className="serif text-2xl">
            Revoke this token?
          </h2>
          <p className="muted">
            Tools using{" "}
            <span className="mono text-foreground">
              {name} · {prefix}
            </span>{" "}
            stop working immediately.
          </p>
          {state?.ok === false && (
            <p role="alert" className="err">
              {state.message}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2 pt-1.5">
            <button type="button" className="btn btn-ghost" onClick={() => dialog.current?.close()}>
              Cancel
            </button>
            <button type="submit" className="btn btn-destructive-solid" disabled={pending}>
              {pending && <span className="spinner" aria-hidden />}
              Revoke token
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
