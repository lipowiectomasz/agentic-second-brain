import Link from "next/link";
import { related } from "@cortex/knowledge";
import { SimilarityBar } from "@/components/search/similarity-bar";
import { getReadDeps } from "@/lib/knowledge";

export async function RelatedPanel({ fileId }: { fileId: string }) {
  let items;
  try {
    items = await related(await getReadDeps(), { fileId, limit: 5 });
  } catch {
    return <p className="text-sm">Related thoughts are unavailable.</p>;
  }
  if (items.length === 0) return <p className="text-sm">No related thoughts yet.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.chunkId}>
          <Link href={`/files/${item.fileId}#${item.anchor}`} className="flex flex-col gap-1 rounded border p-2">
            <span className="flex items-center gap-2 text-xs">
              <span aria-hidden className="inline-block size-2 rounded-full" style={{ backgroundColor: item.sectorColor }} />
              {item.sectorName}
            </span>
            <span className="font-medium">{item.title}</span>
            <span className="text-xs">{item.heading}</span>
            <span className="text-sm">{item.snippet}</span>
            <SimilarityBar similarity={item.similarity} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function RelatedSkeleton() {
  return (
    <div aria-label="Loading related thoughts" className="flex flex-col gap-3">
      {[0, 1, 2].map((row) => (
        <div key={row} className="h-20 animate-pulse rounded bg-neutral-100" />
      ))}
    </div>
  );
}
