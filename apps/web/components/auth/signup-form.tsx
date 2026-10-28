"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { LoginState } from "@/app/(auth)/login/actions";
import { signup } from "@/app/(auth)/signup/actions";
import { FormAlert } from "./form-alert";

export function SignupForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(signup, { error: null });
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="serif" style={{ fontSize: 30, lineHeight: "36px" }}>
          Create an account
        </h1>
        <p className="small muted">Your sectors appear once an admin or maintainer adds you.</p>
      </div>
      {state.error !== null && <FormAlert message={state.error} />}
      <form action={action} className="flex flex-col gap-4">
        <div className="field">
          <label className="label" htmlFor="name">
            Name
          </label>
          <input id="name" name="name" autoComplete="name" required maxLength={128} className="input" />
        </div>
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
          <input id="password" name="password" type="password" autoComplete="new-password" required minLength={12} className="input" aria-describedby="password-hint" />
          <span id="password-hint" className="hint">
            At least 12 characters.
          </span>
        </div>
        <button type="submit" disabled={pending} className="btn btn-primary btn-block" style={{ height: 48 }}>
          {pending && <span className="spinner" aria-hidden />}
          {pending ? "Creating account..." : "Create account"}
        </button>
      </form>
      <p className="small muted text-center">
        <Link href="/login" className="btn-link">
          I already have an account
        </Link>
      </p>
    </div>
  );
}
