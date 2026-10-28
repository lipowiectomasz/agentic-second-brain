import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProposalError, getReviewModel } from "@cortex/proposals";
import { outcomeMessage } from "@/components/proposals/outcome";
import { ProposalReview } from "@/components/proposals/proposal-review";
import { ReviewActions } from "@/components/proposals/review-actions";
import { Banner } from "@/components/ui/banner";
import { NoteCard } from "@/components/ui/note-card";
import { ChangeTag, KindTag, ProposalStatusBadge } from "@/components/ui/tags";
import { requireOrgAdmin } from "@/lib/auth/caller";
import { longDate } from "@/lib/dates";
import { proposalDeps } from "@/lib/proposals";

export const metadata: Metadata = { title: "Review proposal" };

async function Review({ params, searchParams }: { params: PageProps<"/admin/proposals/[id]">["params"]; searchParams: PageProps<"/admin/proposals/[id]">["searchParams"] }) {
  const caller = await requireOrgAdmin("/admin/proposals");
  const { id } = await params;
  const query = await searchParams;
  let model;
  try {
    model = await getReviewModel(caller, id, proposalDeps());
  } catch (error) {
    if (error instanceof ProposalError && error.code === "not_found") notFound();
    throw error;
  }
  const { proposal } = model;
  const decided = proposal.status !== "pending" && proposal.status !== "accepting";
  const justAccepted = typeof query.result === "string" ? outcomeMessage(query.result as never, typeof query.kept === "string" ? Number.parseInt(query.kept, 10) : null) : null;
  return (
    <>
      <header className="flex flex-col gap-3">
        <p className="folio">{proposal.isChange ? "Proposal · change to a spine document" : "Proposal · new spine document"}</p>
        <h1 className="h-display">{proposal.title}</h1>
        <p className="small muted flex flex-wrap items-center gap-2">
          <span className="text-foreground">{proposal.proposerName}</span> proposed {longDate(proposal.createdAt)}
          <KindTag kind={proposal.kind} />
          <ChangeTag change={proposal.isChange ? "change" : "new"} />
          {decided && <ProposalStatusBadge status={proposal.status === "accepting" ? "pending" : proposal.status} />}
        </p>
        <p className="small">
          Target <span className="mono">{proposal.targetPath}</span>
          {proposal.baseVersion !== null && (
            <span className="muted">
              {" "}
              · based on v{proposal.baseVersion}
              {model.currentVersion !== null && model.currentVersion !== proposal.baseVersion ? ` · now v${model.currentVersion}` : ""}
            </span>
          )}
        </p>
        {proposal.sourceSectorId !== null && (
          <p className="small muted">
            Source <span className="text-foreground">{proposal.sourceSectorId}</span> <span className="mono">{proposal.sourcePath}</span>
          </p>
        )}
      </header>
      {justAccepted !== null && (
        <Banner tone="success">
          <p>{justAccepted}</p>
        </Banner>
      )}
      {!decided && model.againstCurrent !== null && proposal.baseVersion !== null && (
        <Banner tone="warning">
          <p className="font-medium">The target changed since this proposal was written.</p>
          <p>Accepting will merge both changes. Compare against the current version below.</p>
        </Banner>
      )}
      {decided && justAccepted === null && (
        <Banner tone={proposal.status === "accepted" ? "success" : "info"}>
          <p>
            {proposal.status === "accepted" ? outcomeMessage(proposal.resultOutcome, proposal.overwrittenVersion) : proposal.status === "rejected" ? "Rejected." : "Withdrawn by the author."}
            {proposal.decidedAt === null ? "" : ` ${longDate(proposal.decidedAt)}.`}
          </p>
          {proposal.decisionNote !== null && <p>“{proposal.decisionNote}”</p>}
        </Banner>
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="flex min-w-0 flex-col gap-5">
          <NoteCard heading={`Rationale · ${proposal.proposerName}`}>{proposal.rationale}</NoteCard>
          <ProposalReview path={proposal.targetPath} content={proposal.content} againstBase={model.againstBase} againstCurrent={model.againstCurrent} baseVersion={proposal.baseVersion} />
        </div>
        {!decided && (
          <div className="lg:sticky lg:top-24 lg:self-start">
            <ReviewActions proposalId={proposal.id} />
          </div>
        )}
      </div>
    </>
  );
}

export default function ProposalReviewPage(props: PageProps<"/admin/proposals/[id]">) {
  return (
    <main className="page">
      <Suspense fallback={<span className="sk block h-96 w-full" />}>
        <Review params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
