import Link from "next/link";
import type { Caller } from "@cortex/server-kit";
import { isOrgAdmin } from "@cortex/server-kit";
import { Wordmark } from "@/components/brand/wordmark";
import type { PaletteSector } from "@/components/search/filter-chips";
import { SearchPalette } from "@/components/search/search-palette";
import { UserMenu } from "./user-menu";

export function AppNav({ caller, reviewsRequests, sectors }: { caller: Caller; reviewsRequests: boolean; sectors: PaletteSector[] }) {
  const admin = isOrgAdmin(caller);
  return (
    <header className="topbar">
      <Link href="/" className="flex h-11 items-center text-inherit no-underline" aria-label="Cortex home">
        <Wordmark />
      </Link>
      <nav aria-label="Main" className="ml-4 flex gap-0.5 overflow-x-auto">
        <Link className="nav-link" href="/">
          Map
        </Link>
        <Link className="nav-link" href="/sectors">
          Sectors
        </Link>
        {(admin || reviewsRequests) && (
          <Link className="nav-link" href="/requests">
            Requests
          </Link>
        )}
        {admin && (
          <Link className="nav-link" href="/admin">
            Admin
          </Link>
        )}
      </nav>
      <div className="flex-1" />
      <SearchPalette sectors={sectors} />
      <UserMenu name={caller.name} />
    </header>
  );
}
