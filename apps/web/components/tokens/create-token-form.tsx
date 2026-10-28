"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { CreateTokenState } from "@/app/(app)/settings/tokens/actions";
import { createTokenAction } from "@/app/(app)/settings/tokens/actions";
import { Icon } from "@/components/ui/icon";
import { longDate } from "@/lib/dates";

const expiries = [7, 30, 90] as const;

function Segmented<T extends string | number>({ label, id, value, options, onChange }: { label: string; id: string; value: T; options: ReadonlyArray<[T, string]>; onChange: (value: T) => void }) {
  return (
    <div className="field">
      <span className="label" id={id}>
        {label}
      </span>
      <div className="seg self-start" role="radiogroup" aria-labelledby={id}>
        {options.map(([option, text]) => (
          <button key={String(option)} type="button" role="radio" aria-checked={value === option} onClick={() => onChange(option)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CreateTokenForm({ limitReached }: { limitReached: boolean }) {
  const [state, action, pending] = useActionState<CreateTokenState, FormData>(createTokenAction, { status: "idle" });
  const [scope, setScope] = useState<"read" | "write">("read");
  const [expiresInDays, setExpiresInDays] = useState<7 | 30 | 90>(30);
  const [copied, setCopied] = useState(false);
  const reveal = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (state.status === "created") reveal.current?.showModal();
  }, [state]);

  return (
    <>
      <form action={action} className="card flex flex-col gap-4.5 p-6">
        <h2 className="h-card">New token</h2>
        <input type="hidden" name="scope" value={scope} />
        <input type="hidden" name="expiresInDays" value={expiresInDays} />
        <div className="field">
          <label className="label" htmlFor="token-name">
            Name
          </label>
          <input id="token-name" name="name" className="input" maxLength={64} required aria-invalid={state.status === "error" && state.field === "name"} />
          <span className="hint">Where it will live, e.g. “laptop-cli”. Up to 64 characters.</span>
        </div>
        <Segmented label="Access" id="token-access" value={scope} options={[["read", "Read only"], ["write", "Read and write"]]} onChange={setScope} />
        <Segmented label="Expires in" id="token-expiry" value={expiresInDays} options={expiries.map((days) => [days, `${days} days`] as [7 | 30 | 90, string])} onChange={setExpiresInDays} />
        {limitReached && (
          <p className="err" role="alert">
            You already have 10 active tokens. Revoke one to create another.
          </p>
        )}
        {state.status === "error" && (
          <p className="err" role="alert">
            {state.message}
          </p>
        )}
        <button type="submit" className="btn btn-primary self-start" disabled={pending || limitReached}>
          {pending && <span className="spinner" aria-hidden />}
          Create token
        </button>
      </form>
      <dialog ref={reveal} aria-labelledby="token-reveal-title" className="dialog-seal m-auto flex w-[min(560px,calc(100%-32px))] flex-col gap-4.5 p-7 text-foreground backdrop:bg-[var(--scrim)] [&:not([open])]:hidden">
        {state.status === "created" && (
          <>
            <div className="flex flex-col gap-1">
              <h2 id="token-reveal-title" className="serif text-[26px] leading-8">
                Copy your new token
              </h2>
              <p className="small muted">
                <span className="mono text-foreground">{state.name}</span> · {state.scope === "read" ? "Read only" : "Read and write"} · expires {longDate(state.expiresAt)}
              </p>
            </div>
            <div className="perforated flex flex-wrap items-center gap-3 p-4">
              <code className="mono min-w-0 flex-[1_1_260px] text-[15px] leading-6 [overflow-wrap:anywhere]" aria-label="New token">
                {state.value}
              </code>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  void navigator.clipboard.writeText(state.value).then(() => setCopied(true));
                }}
              >
                <Icon name={copied ? "check" : "copy"} size={14} />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="flex items-center gap-2 font-medium" style={{ color: "var(--warning)" }}>
              <Icon name="warning" size={16} />
              This token will not be shown again.
            </p>
            <hr className="rule" />
            <div className="flex justify-end">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setCopied(false);
                  reveal.current?.close();
                }}
              >
                I’ve stored it
              </button>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
