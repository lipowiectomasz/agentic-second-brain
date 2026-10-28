export interface NavItem {
  href: string;
  label: string;
  count?: number;
}

export interface ProposalsNav {
  pendingForAdmin: number;
}

export function mainNavItems({ admin, reviewsRequests, proposals }: { admin: boolean; reviewsRequests: boolean; proposals: ProposalsNav | null }): NavItem[] {
  return [
    { href: "/", label: "Map" },
    { href: "/sectors", label: "Sectors" },
    ...(proposals === null ? [] : [{ href: "/proposals", label: "Proposals" }]),
    ...(admin || reviewsRequests ? [{ href: "/requests", label: "Requests" }] : []),
  ];
}

export function adminNavItems(proposals: ProposalsNav | null): NavItem[] {
  return [
    { href: "/admin/sectors", label: "Sectors" },
    { href: "/admin/access", label: "Access" },
    ...(proposals === null ? [] : [{ href: "/admin/proposals", label: "Proposals", count: proposals.pendingForAdmin }]),
    { href: "/admin/tokens", label: "Tokens" },
    { href: "/admin/audit", label: "Audit" },
  ];
}
