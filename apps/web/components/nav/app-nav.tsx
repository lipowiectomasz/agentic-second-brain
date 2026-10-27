import Link from "next/link";
import type { Caller } from "@cortex/server-kit";
import { isOrgAdmin } from "@cortex/server-kit";
import type { PaletteSector } from "@/components/search/filter-chips";
import { SearchPalette } from "@/components/search/search-palette";
import { UserMenu } from "./user-menu";

export function AppNav({ caller, reviewsRequests, sectors }: { caller: Caller; reviewsRequests: boolean; sectors: PaletteSector[] }) {
  const admin = isOrgAdmin(caller);
  return (
    <header className="flex items-center justify-between border-b px-4 py-3">
      <nav aria-label="Main" className="flex items-center gap-4">
        <Link href="/" className="font-semibold">
          Cortex
        </Link>
        <Link href="/sectors">Sectors</Link>
        {(admin || reviewsRequests) && <Link href="/requests">Requests</Link>}
        {admin && <Link href="/admin">Admin</Link>}
      </nav>
      <div className="flex items-center gap-3">
        <SearchPalette sectors={sectors} />
        <UserMenu name={caller.name} />
      </div>
    </header>
  );
}
