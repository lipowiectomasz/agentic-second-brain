"use client";

import Link from "next/link";
import { signOut } from "@/app/(app)/actions/sign-out";
import { ThemeToggle } from "@/components/theme/theme-toggle";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => part !== "")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserMenu({ name }: { name: string }) {
  return (
    <details className="relative">
      <summary className="btn btn-ghost list-none" style={{ padding: "0 6px" }} aria-label={`Account menu, ${name}`}>
        <span className="avatar">{initials(name)}</span>
        <span className="hide-sm small">{name}</span>
      </summary>
      <div className="raised absolute right-0 z-30 mt-2 flex min-w-60 flex-col gap-3 p-3">
        <Link href="/profile" className="nav-link">
          Profile
        </Link>
        <Link href="/settings/tokens" className="nav-link">
          Access tokens
        </Link>
        <ThemeToggle />
        <hr className="rule" />
        <form action={signOut}>
          <button type="submit" className="btn btn-ghost btn-sm btn-block">
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}
