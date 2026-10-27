import { notFound } from "next/navigation";
import { Suspense } from "react";
import { KnowledgeError, readFile } from "@cortex/knowledge";
import { MarkdownView } from "@/components/files/markdown-view";
import { RelatedPanel, RelatedSkeleton } from "@/components/files/related-panel";
import { SupersededBanner } from "@/components/files/superseded-banner";
import { StatusBadge } from "@/components/search/status-badge";
import { getReadDeps } from "@/lib/knowledge";

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
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <header className="flex flex-col gap-2">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            {file.docId !== null && <span className="font-mono">{file.docId}</span>}
            <StatusBadge status={file.status} />
            <span className="rounded border px-1.5 py-0.5 text-xs">{file.kind}</span>
            <span className="text-xs">v{file.version}</span>
          </p>
          <h1 className="text-3xl font-semibold">{file.title}</h1>
          <p className="font-mono text-xs">{file.path}</p>
          {file.supersedes !== null && <p className="text-sm">Supersedes {file.supersedes}</p>}
          {file.supersededBy !== null && <SupersededBanner docId={file.supersededBy} fileId={file.supersededByFileId} />}
        </header>
        <MarkdownView body={file.body} />
      </div>
      <aside aria-label="Related thoughts" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Related thoughts</h2>
        <Suspense fallback={<RelatedSkeleton />}>
          <RelatedPanel fileId={file.fileId} />
        </Suspense>
      </aside>
    </div>
  );
}

export default function FilePage(props: PageProps<"/files/[fileId]">) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <Suspense fallback={<p>Loading...</p>}>
        <FileDetails params={props.params} />
      </Suspense>
    </main>
  );
}
