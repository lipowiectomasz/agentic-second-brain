import { notFound } from "next/navigation";
import { Suspense } from "react";
import { KnowledgeError, readFile } from "@cortex/knowledge";
import { MarkdownView } from "@/components/files/markdown-view";
import { RelatedPanel, RelatedSkeleton } from "@/components/files/related-panel";
import { SupersededBanner } from "@/components/files/superseded-banner";
import { StatusBadge } from "@/components/search/status-badge";
import { getReadDeps } from "@/lib/knowledge";
import { withoutLeadingTitle } from "@/lib/markdown";

async function FileDetails({ params }: { params: PageProps<"/files/[fileId]">["params"] }) {
  const { fileId } = await params;
  let file;
  try {
    file = await readFile(await getReadDeps(), { fileId });
  } catch (error) {
    if (error instanceof KnowledgeError && (error.code === "not_found" || error.code === "forbidden")) notFound();
    throw error;
  }
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <header className="flex flex-col gap-3">
          <p className="flex flex-wrap items-center gap-2">
            {file.docId !== null && <span className="folio">{file.docId}</span>}
            <StatusBadge status={file.status} />
            <span className="badge badge-kind">{file.kind}</span>
            <span className="folio">v{file.version}</span>
          </p>
          <h1 className="serif text-[46px] leading-[52px] tracking-[-0.015em]">{file.title}</h1>
          <p className="mono xsmall muted break-all">{file.path}</p>
          {file.supersedes !== null && <p className="small muted">Supersedes <span className="mono">{file.supersedes}</span></p>}
          {file.supersededBy !== null && <SupersededBanner docId={file.supersededBy} fileId={file.supersededByFileId} />}
          <hr className="rule-double mt-2" />
        </header>
        <MarkdownView body={withoutLeadingTitle(file.body, file.title)} />
      </div>
      <aside aria-label="Related thoughts" className="flex flex-col gap-3 lg:sticky lg:top-24 lg:self-start">
        <h2 className="folio">Related thoughts</h2>
        <hr className="rule-ink" />
        <Suspense fallback={<RelatedSkeleton />}>
          <RelatedPanel fileId={file.fileId} />
        </Suspense>
      </aside>
    </div>
  );
}

export default function FilePage(props: PageProps<"/files/[fileId]">) {
  return (
    <main className="page">
      <Suspense fallback={<FileSkeleton />}>
        <FileDetails params={props.params} />
      </Suspense>
    </main>
  );
}

function FileSkeleton() {
  return (
    <div aria-label="Loading file" className="flex flex-col gap-4">
      <span className="sk block h-5 w-48" />
      <span className="sk block h-12 w-[70%]" />
      <span className="sk block h-3 w-[40%]" />
      <span className="sk mt-6 block h-64 w-full max-w-[var(--prose-max)]" />
    </div>
  );
}
