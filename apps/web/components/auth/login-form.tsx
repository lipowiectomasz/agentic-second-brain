"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { LoginState } from "@/app/(auth)/login/actions";
import { loginWithPassword } from "@/app/(auth)/login/actions";

export function LoginForm({ next, githubEnabled, oauthFailed }: { next: string; githubEnabled: boolean; oauthFailed: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginWithPassword, { error: null });
  const error = state.error ?? (oauthFailed ? "Signing in with GitHub failed. Try again." : null);
  return (
    <div className="flex flex-col gap-4">
      {githubEnabled && (
        <>
          <a href={`/auth/github?next=${encodeURIComponent(next)}`} className="rounded border px-4 py-2 text-center">
            Continue with GitHub
          </a>
          <p className="text-center text-sm">or</p>
        </>
      )}
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <label className="flex flex-col gap-1">
          Email
          <input name="email" type="email" autoComplete="email" required className="rounded border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          Password
          <input name="password" type="password" autoComplete="current-password" required className="rounded border px-3 py-2" />
        </label>
        {error !== null && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <button type="submit" disabled={pending} className="rounded bg-black px-4 py-2 text-white disabled:opacity-60">
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <Link href="/signup" className="text-center text-sm underline">
        Create an account
      </Link>
    </div>
  );
}
