import Link from "next/link";
import type { Caller } from "@cortex/server-kit";
import { isOrgAdmin } from "@cortex/server-kit";
import { UserMenu } from "./user-menu";

export function AppNav({ caller }: { caller: Caller }) {
  return (
    <header className="flex items-center justify-between border-b px-4 py-3">
      <nav aria-label="Main" className="flex items-center gap-4">
        <Link href="/" className="font-semibold">
          Cortex
        </Link>
        {isOrgAdmin(caller) && <Link href="/admin">Admin</Link>}
      </nav>
      <UserMenu name={caller.name} />
    </header>
  );
}
