"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { Icon } from "@/components/ui/icon";
import { NavCount } from "./nav-count";
import type { NavItem } from "./nav-links";

function isCurrent(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function MobileNav({ items, adminItems }: { items: NavItem[]; adminItems: NavItem[] | null }) {
  const sheet = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const close = () => sheet.current?.close();

  function renderLink(item: NavItem) {
    return (
      <Link key={item.href} href={item.href} className="nav-link justify-between" aria-current={isCurrent(pathname, item.href) ? "page" : undefined} onClick={close}>
        {item.label}
        {item.count !== undefined && <NavCount count={item.count} />}
      </Link>
    );
  }

  return (
    <>
      <button type="button" className="btn btn-ghost btn-icon show-sm" aria-label="Open menu" onClick={() => sheet.current?.showModal()}>
        <Icon name="menu" size={18} />
      </button>
      <dialog
        ref={sheet}
        aria-label="Menu"
        className="sheet"
        onClick={(event) => {
          if (event.target === sheet.current) close();
        }}
      >
        <div className="flex items-center justify-between pb-2">
          <Wordmark />
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Close menu" onClick={close}>
            <Icon name="cross" size={16} />
          </button>
        </div>
        <nav aria-label="Main menu" className="flex flex-col gap-1">
          {items.map(renderLink)}
          {adminItems !== null && (
            <>
              <span className="folio px-2.5 pt-2.5 pb-0.5">Admin</span>
              {adminItems.map(renderLink)}
            </>
          )}
        </nav>
      </dialog>
    </>
  );
}
