import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { FileView } from "@cortex/knowledge";
import { KnowledgeError, readFile } from "@cortex/knowledge";
import { CopyPathButton } from "@/components/documents/copy-path-button";
import { DocId } from "@/components/documents/doc-id";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { FileHeaderActions } from "@/components/documents/file-header-actions";
import { FindingsList } from "@/components/documents/findings-list";
import { MarkdownView } from "@/components/files/markdown-view";
import { RelatedPanel, RelatedSkeleton } from "@/components/files/related-panel";
import { SectorBadge } from "@/components/sectors/sector-badge";
import { Banner } from "@/components/ui/banner";
import { Icon } from "@/components/ui/icon";
import { longDate } from "@/lib/dates";
import { versionLine } from "@/lib/document-status";
import { getReadDeps } from "@/lib/knowledge";
import { withoutLeadingTitle } from "@/lib/markdown";

function StaleBanner({ file }: { file: FileView }) {
  if (file.status === "superseded" && file.supersededBy !== null) {
    const replacement = file.supersededBy;
    const href = file.supersededByFileId === null ? undefined : `/files/${file.supersededByFileId}`;
    return (
      <Banner
        tone="warning"
        action={
          href === undefined ? undefined : (
            <Link href={href} className="btn btn-secondary btn-sm">
              Open {replacement}
            </Link>
          )
        }
      >
        <p>
          This document was superseded by <DocId id={replacement} {...(href === undefined ? {} : { href })} />. It stays readable for history but is hidden from search.
        </p>
      </Banner>
    );
  }
  if (file.status === "deprecated") {
    return (
      <Banner tone="warning">
        <p>This document is deprecated. It stays readable for history but is hidden from search.</p>
      </Banner>
    );
  }
  return null;
}

async function FileDetails({ params }: { params: PageProps<"/files/[fileId]">["params"] }) {
  const { fileId } = await params;
  let file;
  try {
    file = await readFile(await getReadDeps(), { fileId });
  } catch (error) {
    if (error instanceof KnowledgeError && (error.code === "not_found" || error.code === "forbidden")) notFound();
    throw error;
  }
  const stale = file.status === "superseded" || file.status === "deprecated";
  const history = versionLine(file.version);
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <header className="flex max-w-[var(--prose-max)] flex-col gap-3.5">
          <p className="flex flex-wrap items-center gap-2">
            <SectorBadge name={file.sector.name} color={file.sector.color} />
            <span className="badge badge-kind">{file.kind}</span>
            {file.docId !== null && <DocId id={file.docId} />}
            {file.status !== null && <DocumentStatusBadge status={file.status} />}
            <span className="badge badge-role mono">v{file.version}</span>
          </p>
          <h1 className={`serif text-[46px] leading-[52px] tracking-[-0.02em] text-balance ${stale ? "muted" : ""}`}>{file.title}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="inline-flex min-w-0 max-w-full items-center gap-0.5">
              <span className="mono muted truncate text-[13px]">{file.path}</span>
              <CopyPathButton path={file.path} />
            </span>
            <span className="small muted">Updated {longDate(file.updatedAt)}</span>
            {history !== null && (
              <span className="small inline-flex items-center gap-1.5">
                <Icon name="history" size={14} />
                {history}
              </span>
            )}
          </div>
          {file.supersedes !== null && (
            <p className="small muted flex items-center gap-1.5">
              <Icon name="superseded" size={14} />
              Supersedes <DocId id={file.supersedes} {...(file.supersedesFileId === null ? {} : { href: `/files/${file.supersedesFileId}` })} />
            </p>
          )}
          <FileHeaderActions />
          <hr className="rule-double mt-1.5" />
          {file.docId !== null && file.kind !== "finding" && (
            <Suspense fallback={null}>
              <FindingsList sectorId={file.sectorId} docId={file.docId} sector={file.sector} />
            </Suspense>
          )}
        </header>
        <StaleBanner file={file} />
        <MarkdownView body={withoutLeadingTitle(file.body, file.title)} dimmed={stale} />
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
