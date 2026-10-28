import type { Metadata } from "next";
import { Suspense } from "react";
import { readFile } from "@cortex/knowledge";
import { PageHeader } from "@/components/page-header";
import type { ProposalDefaults } from "@/components/proposals/proposal-form";
import { ProposalForm } from "@/components/proposals/proposal-form";
import { requireCaller } from "@/lib/auth/caller";
import { getReadDeps } from "@/lib/knowledge";

export const metadata: Metadata = { title: "New proposal" };

const empty: ProposalDefaults = { kind: "standard", targetPath: "standards/", baseVersion: null, title: "", content: "", changeOf: null };

async function Form({ searchParams }: { searchParams: PageProps<"/proposals/new">["searchParams"] }) {
  await requireCaller("/proposals/new");
  const params = await searchParams;
  const from = typeof params.from === "string" ? params.from : null;
  let defaults = empty;
  if (from !== null) {
    try {
      const file = await readFile(await getReadDeps(), { fileId: from });
      if ((file.kind === "standard" || file.kind === "procedure") && file.sectorId === "spine") {
        defaults = { kind: file.kind, targetPath: file.path, baseVersion: file.version, title: file.title, content: file.body, changeOf: { fileId: file.fileId, path: file.path, version: file.version } };
      }
    } catch {
      defaults = empty;
    }
  }
  return <ProposalForm defaults={defaults} />;
}

export default function NewProposalPage(props: PageProps<"/proposals/new">) {
  return (
    <main className="page">
      <PageHeader folio="Proposals" title="New proposal" />
      <Suspense fallback={<span className="sk block h-96 w-full" />}>
        <Form searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
