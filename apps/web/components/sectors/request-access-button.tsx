"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { requestAccessAction } from "@/app/(app)/sectors/actions";

export function RequestAccessButton({ sectorId, sectorName }: { sectorId: string; sectorName: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(requestAccessAction, null);
  const [role, setRole] = useState<"reader" | "maintainer">("reader");
  return (
    <details>
      <summary className="btn btn-secondary btn-sm list-none">Request access</summary>
      <form action={action} className="sunken mt-3 flex flex-col gap-3 rounded border border-border p-3.5">
        <input type="hidden" name="sectorId" value={sectorId} />
        <input type="hidden" name="role" value={role} />
        <div className="field">
          <span className="label" id={`role-${sectorId}`}>
            Ask to join {sectorName} as
          </span>
          <div className="seg self-start" role="radiogroup" aria-labelledby={`role-${sectorId}`} style={{ background: "var(--surface)" }}>
            {(["reader", "maintainer"] as const).map((option) => (
              <button key={option} type="button" role="radio" aria-checked={role === option} onClick={() => setRole(option)}>
                {option === "reader" ? "Reader" : "Maintainer"}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor={`message-${sectorId}`}>
            Message (optional)
          </label>
          <textarea id={`message-${sectorId}`} name="message" maxLength={280} rows={2} className="input" style={{ minHeight: 64, background: "var(--surface)" }} />
        </div>
        {state?.ok === false && (
          <p role="alert" className="err">
            {state.message}
          </p>
        )}
        <div className="flex justify-end">
          <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
            {pending && <span className="spinner" aria-hidden />}
            Send request
          </button>
        </div>
      </form>
    </details>
  );
}
