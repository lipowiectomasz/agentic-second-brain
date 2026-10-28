import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import type { ProposalStatus } from "@cortex/proposals";
import { listForReview } from "@cortex/proposals";
import { AdminNav } from "@/components/admin/admin-nav";
import { PageHeader } from "@/components/page-header";
import { ChangeTag, KindTag, ProposalStatusBadge } from "@/components/ui/tags";
import { requireOrgAdmin } from "@/lib/auth/caller";
import { longDate } from "@/lib/dates";
import { sessionTables } from "@/lib/proposals";

export const metadata: Metadata = { title: "Proposals" };

const filters: Array<[ProposalStatus | "all", string]> = [
  ["pending", "Pending"],
  ["accepted", "Accepted"],
  ["rejected", "Rejected"],
  ["all", "All"],
];

async function Queue({ searchParams }: { searchParams: PageProps<"/admin/proposals">["searchParams"] }) {
  const caller = await requireOrgAdmin("/admin/proposals");
  const params = await searchParams;
  const filter = filters.find(([value]) => value === params.status)?.[0] ?? "pending";
  const { tables, databaseId } = await sessionTables();
  const { items } = await listForReview(caller, tables, databaseId, filter);
  return (
    <div className="flex flex-col gap-4">
      <nav className="seg self-start" aria-label="Filter proposals">
        {filters.map(([value, label]) => (
          <Link key={value} href={value === "pending" ? "/admin/proposals" : `/admin/proposals?status=${value}`} className="inline-flex h-[34px] items-center rounded-sm px-2.5 no-underline" aria-current={filter === value ? "page" : undefined} style={filter === value ? { background: "var(--surface)", color: "var(--foreground)", boxShadow: "var(--shadow-sm)" } : undefined}>
            {label}
          </Link>
        ))}
      </nav>
      <p className="xsmall muted">
        {items.length} {items.length === 1 ? "proposal" : "proposals"}
      </p>
      {items.length === 0 ? (
        <p className="card small muted p-8 text-center">No proposals waiting for review.</p>
      ) : (
        <div className="card overflow-hidden p-0">
          {items.map((item) => (
            <Link key={item.id} href={`/admin/proposals/${item.id}`} className="row-link grid-cols-1 sm:grid-cols-[180px_minmax(0,1fr)_auto]" aria-label={`${item.title} by ${item.proposerName}`}>
              <span className="flex items-center gap-2">
                <span className="avatar">{item.proposerName.slice(0, 2).toUpperCase()}</span>
                <span className="small">{item.proposerName}</span>
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="font-medium">{item.title}</span>
                <span className="mono xsmall muted truncate">{item.targetPath}</span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <KindTag kind={item.kind} />
                <ChangeTag change={item.isChange ? "change" : "new"} />
                <ProposalStatusBadge status={item.status === "accepting" ? "pending" : item.status} />
                <span className="xsmall muted whitespace-nowrap" title={item.createdAt}>
                  {longDate(item.createdAt)}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminProposalsPage(props: PageProps<"/admin/proposals">) {
  return (
    <main className="page">
      <PageHeader folio="Admin" title="Proposals" />
      <p className="muted -mt-4">Review suggestions for the spine.</p>
      <AdminNav />
      <Suspense fallback={<span className="sk block h-40 w-full" />}>
        <Queue searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
