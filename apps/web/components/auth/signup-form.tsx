"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { LoginState } from "@/app/(auth)/login/actions";
import { signup } from "@/app/(auth)/signup/actions";

export function SignupForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(signup, { error: null });
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        Name
        <input name="name" autoComplete="name" required maxLength={128} className="rounded border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1">
        Email
        <input name="email" type="email" autoComplete="email" required className="rounded border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1">
        Password
        <input name="password" type="password" autoComplete="new-password" required minLength={12} className="rounded border px-3 py-2" />
        <span className="text-sm">At least 12 characters.</span>
      </label>
      {state.error !== null && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="rounded bg-black px-4 py-2 text-white disabled:opacity-60">
        {pending ? "Creating account..." : "Create account"}
      </button>
      <Link href="/login" className="text-center text-sm underline">
        I already have an account
      </Link>
    </form>
  );
}
