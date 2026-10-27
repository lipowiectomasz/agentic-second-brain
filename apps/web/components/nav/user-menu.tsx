"use client";

import Link from "next/link";
import { signOut } from "@/app/(app)/actions/sign-out";

export function UserMenu({ name }: { name: string }) {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none">{name}</summary>
      <div className="absolute right-0 mt-2 flex min-w-40 flex-col gap-2 rounded border bg-white p-3">
        <Link href="/profile">Profile</Link>
        <form action={signOut}>
          <button type="submit">Sign out</button>
        </form>
      </div>
    </details>
  );
}
