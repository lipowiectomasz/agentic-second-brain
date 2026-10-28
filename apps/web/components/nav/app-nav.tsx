import Link from "next/link";
import type { Caller } from "@cortex/server-kit";
import { isOrgAdmin } from "@cortex/server-kit";
import { Wordmark } from "@/components/brand/wordmark";
import type { PaletteSector } from "@/components/search/filter-chips";
import { SearchPalette } from "@/components/search/search-palette";
import { MobileNav } from "./mobile-nav";
import type { ProposalsNav } from "./nav-links";
import { adminNavItems, mainNavItems } from "./nav-links";
import { UserMenu } from "./user-menu";

export function AppNav({ caller, reviewsRequests, sectors, proposals = null }: { caller: Caller; reviewsRequests: boolean; sectors: PaletteSector[]; proposals?: ProposalsNav | null }) {
  const admin = isOrgAdmin(caller);
  const items = mainNavItems({ admin, reviewsRequests, proposals });
  return (
    <header className="topbar">
      <MobileNav items={items} adminItems={admin ? adminNavItems(proposals) : null} />
      <Link href="/" className="flex h-11 items-center text-inherit no-underline" aria-label="Cortex home">
        <Wordmark />
      </Link>
      <nav aria-label="Main" className="hide-sm ml-4 flex gap-0.5">
        {items.map((item) => (
          <Link key={item.href} className="nav-link" href={item.href}>
            {item.label}
          </Link>
        ))}
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
