import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { listMine } from "@cortex/proposals";
import { PageHeader } from "@/components/page-header";
import { outcomeMessage } from "@/components/proposals/outcome";
import { WithdrawButton } from "@/components/proposals/withdraw-button";
import { Banner } from "@/components/ui/banner";
import { ChangeTag, KindTag, ProposalStatusBadge } from "@/components/ui/tags";
import { requireCaller } from "@/lib/auth/caller";
import { longDate } from "@/lib/dates";
import { sessionTables } from "@/lib/proposals";

export const metadata: Metadata = { title: "Proposals" };

async function MyProposals() {
  const caller = await requireCaller("/proposals");
  const { tables, databaseId } = await sessionTables();
  let items;
  try {
    items = await listMine(caller, tables, databaseId);
  } catch {
    return (
      <Banner tone="danger" action={<Link href="/proposals" className="btn btn-secondary btn-sm">Try again</Link>}>
        <p>Proposals are unavailable. Try again.</p>
      </Banner>
    );
  }
  if (items.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-3 p-10 text-center">
        <p className="serif text-xl">You have not proposed anything yet.</p>
        <Link href="/proposals/new" className="btn btn-primary">
          New proposal
        </Link>
      </div>
    );
  }
  return (
    <div className="tbl-box">
      <table className="tbl min-w-[860px]">
        <thead>
          <tr>
            <th>Proposal</th>
            <th>Kind</th>
            <th>Type</th>
            <th>Status</th>
            <th>Submitted</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{item.title}</span>
                  <span className="mono xsmall muted">{item.targetPath}</span>
                  {item.status === "accepted" && <span className="xsmall" style={{ color: "var(--success)" }}>{outcomeMessage(item.resultOutcome, item.overwrittenVersion)}</span>}
                  {item.status === "rejected" && item.decisionNote !== null && (
                    <blockquote className="serif small m-0 italic">
                      “{item.decisionNote}” <span className="xsmall muted not-italic">- {item.decidedAt === null ? "" : longDate(item.decidedAt)}</span>
                    </blockquote>
                  )}
                </div>
              </td>
              <td>
                <KindTag kind={item.kind} />
              </td>
              <td>
                <ChangeTag change={item.isChange ? "change" : "new"} />
              </td>
              <td>
                <ProposalStatusBadge status={item.status === "accepting" ? "pending" : item.status} />
              </td>
              <td className="small muted whitespace-nowrap">{longDate(item.createdAt)}</td>
              <td className="text-right">
                {item.status === "pending" && <WithdrawButton proposalId={item.id} />}
                {item.status === "accepted" && item.resultFileId !== null && (
                  <Link href={`/files/${item.resultFileId}`} className="btn btn-ghost btn-sm">
                    View in spine
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function SubmittedNotice({ searchParams }: { searchParams: PageProps<"/proposals">["searchParams"] }) {
  const params = await searchParams;
  if (params.submitted !== "1") return null;
  return (
    <Banner tone="success">
      <p>Proposal submitted. An admin will review it.</p>
    </Banner>
  );
}

export default function ProposalsPage(props: PageProps<"/proposals">) {
  return (
    <main className="page">
      <PageHeader folio="Spine · your suggestions" title="Proposals">
        <Link href="/proposals/new" className="btn btn-primary">
          New proposal
        </Link>
      </PageHeader>
      <p className="muted -mt-4">Suggest new standards and procedures for the whole organisation.</p>
      <Suspense fallback={null}>
        <SubmittedNotice searchParams={props.searchParams} />
      </Suspense>
      <Suspense fallback={<div className="flex flex-col gap-2">{[0, 1, 2, 3].map((row) => <span key={row} className="sk block h-14 w-full" />)}</div>}>
        <MyProposals />
      </Suspense>
    </main>
  );
}
