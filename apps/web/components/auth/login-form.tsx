"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { LoginState } from "@/app/(auth)/login/actions";
import { loginWithPassword } from "@/app/(auth)/login/actions";
import { FormAlert } from "./form-alert";

export function LoginForm({ next, githubEnabled, oauthFailed }: { next: string; githubEnabled: boolean; oauthFailed: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginWithPassword, { error: null });
  const error = state.error ?? (oauthFailed ? "Signing in with GitHub failed. Try again." : null);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="serif" style={{ fontSize: 30, lineHeight: "36px" }}>
          Sign in
        </h1>
        <p className="small muted">One brain for every project your team works on.</p>
      </div>
      {error !== null && <FormAlert message={error} />}
      {githubEnabled && (
        <>
          <a href={`/auth/github?next=${encodeURIComponent(next)}`} className="btn btn-secondary btn-block" style={{ height: 48 }}>
            Continue with GitHub
          </a>
          <div className="flex items-center gap-3" aria-hidden>
            <hr className="rule flex-1" />
            <span className="folio">or</span>
            <hr className="rule flex-1" />
          </div>
        </>
      )}
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <div className="field">
          <label className="label" htmlFor="email">
            Email
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        </div>
        <div className="field">
          <label className="label" htmlFor="password">
            Password
          </label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className={`input${error !== null ? " is-invalid" : ""}`} />
        </div>
        <button type="submit" disabled={pending} className="btn btn-primary btn-block" style={{ height: 48 }}>
          {pending && <span className="spinner" aria-hidden />}
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="small muted text-center">
        New to Cortex?{" "}
        <Link href="/signup" className="btn-link">
          Create an account
        </Link>
      </p>
    </div>
  );
}
