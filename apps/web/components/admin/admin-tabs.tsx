"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavCount } from "@/components/nav/nav-count";
import type { ProposalsNav } from "@/components/nav/nav-links";
import { adminNavItems } from "@/components/nav/nav-links";

export function AdminTabs({ proposals = null }: { proposals?: ProposalsNav | null }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="-mb-3 flex gap-1 overflow-x-auto border-b border-border">
      {adminNavItems(proposals).map((tab) => (
        <Link key={tab.href} href={tab.href} className="tab" aria-current={pathname.startsWith(tab.href) ? "page" : undefined}>
          {tab.label}
          {tab.count !== undefined && <NavCount count={tab.count} compact />}
        </Link>
      ))}
    </nav>
  );
}
