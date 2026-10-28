"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin/sectors", label: "Sectors" },
  { href: "/admin/access", label: "Access" },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="-mb-3 flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} className="tab" aria-current={pathname.startsWith(tab.href) ? "page" : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
