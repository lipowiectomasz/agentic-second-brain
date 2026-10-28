import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { documentStatuses } from "@cortex/core/document-status";
import { DiffView } from "@/components/diff/diff-view";
import { DocId } from "@/components/documents/doc-id";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { FileHeaderActions } from "@/components/documents/file-header-actions";
import { NavCount } from "@/components/nav/nav-count";
import { Banner } from "@/components/ui/banner";
import { ConfirmPopover } from "@/components/ui/confirm-popover";
import { NoteCard } from "@/components/ui/note-card";
import { ChangeTag, KindTag, ProposalStatusBadge } from "@/components/ui/tags";
import { sampleDiff } from "./sample-diff";

export const metadata: Metadata = { title: "Components" };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="h-card italic">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="page">
      <p className="folio">Components · proposals and document lifecycle</p>
      <h1 className="h-display">Component sheet</h1>
      <Section title="Document status">
        <div className="flex flex-col gap-2">
          {documentStatuses.map((status) => (
            <p key={status} className="flex flex-wrap items-center gap-2">
              <DocumentStatusBadge status={status} />
            </p>
          ))}
          <p className="flex flex-wrap items-center gap-2">
            <DocId id="SPEC-014" />
            <DocId id="SPEC-007" href="/design" />
          </p>
        </div>
      </Section>
      <Section title="Proposal status, kind and type">
        <p className="flex flex-wrap items-center gap-2">
          <ProposalStatusBadge status="pending" />
          <ProposalStatusBadge status="accepted" />
          <ProposalStatusBadge status="rejected" />
          <ProposalStatusBadge status="withdrawn" />
          <KindTag kind="standard" />
          <KindTag kind="procedure" />
          <ChangeTag change="new" />
          <ChangeTag change="change" />
        </p>
      </Section>
      <Section title="Navigation counter">
        <nav aria-label="Counter samples" className="flex flex-wrap gap-1">
          {[0, 3, 12, 120].map((count) => (
            <a key={count} href="#counter" className="nav-link" data-count={count}>
              Proposals
              <NavCount count={count} />
            </a>
          ))}
          <a href="#counter" className="tab">
            Proposals
            <NavCount count={3} compact />
          </a>
        </nav>
      </Section>
      <Section title="Banners">
        <div className="flex flex-col gap-3">
          <Banner tone="info" action={<a href="#banners">Open current</a>}>
            <p>
              You are proposing a change to <span className="mono">standards/git-branching.md</span> (v4).
            </p>
          </Banner>
          <Banner tone="warning" action={<a href="#banners">Compare</a>}>
            <p>The target changed since this proposal was submitted.</p>
          </Banner>
          <Banner tone="success">
            <p>Accepted and published to the spine.</p>
          </Banner>
          <Banner tone="danger" action={<button type="button" className="btn btn-secondary btn-sm">Try again</button>}>
            <p>Proposals are unavailable. Try again.</p>
          </Banner>
        </div>
      </Section>
      <Section title="Rationale">
        <NoteCard heading="Rationale · Jonas Berg">Atlas moved to short-lived branches in September. Release branches now only exist for hotfixes, so the spine should stop telling people to cut one every sprint.</NoteCard>
      </Section>
      <Section title="Confirm popover">
        <div>
          <ConfirmPopover
            id="withdraw-sample"
            triggerLabel="Withdraw"
            title="Withdraw this proposal?"
            description="It leaves the review queue. You can propose it again later."
            confirm={
              <button type="button" className="btn btn-destructive btn-sm">
                Withdraw
              </button>
            }
          />
        </div>
      </Section>
      <Section title="File actions">
        <FileHeaderActions proposeHref="/design" />
      </Section>
      <Section title="Diff view">
        <DiffView path="standards/git-branching.md" rows={sampleDiff} />
      </Section>
    </main>
  );
}
