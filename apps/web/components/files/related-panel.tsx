import Link from "next/link";
import { related } from "@cortex/knowledge";
import { SimilarityBar } from "@/components/search/similarity-bar";
import { sectorStyle } from "@/components/sectors/sector-badge";
import { getReadDeps } from "@/lib/knowledge";

export async function RelatedPanel({ fileId }: { fileId: string }) {
  let items;
  try {
    items = await related(await getReadDeps(), { fileId, limit: 5 });
  } catch {
    return <p className="small muted">Related thoughts are unavailable.</p>;
  }
  if (items.length === 0) return <p className="small muted">No related thoughts yet.</p>;
  return (
    <ul className="stagger flex flex-col">
      {items.map((item) => (
        <li key={item.chunkId} className="border-b border-border last:border-b-0">
          <Link href={`/files/${item.fileId}#${item.anchor}`} className="flex flex-col gap-1 py-3.5 text-foreground no-underline hover:text-accent" style={sectorStyle(item.sectorColor)}>
            <span className="xsmall flex items-center gap-2">
              <span aria-hidden className="dot" />
              <span className="serif italic" style={{ color: "var(--c)" }}>
                {item.sectorName}
              </span>
            </span>
            <span className="serif text-[17px] leading-6">{item.title}</span>
            <span className="xsmall muted">{item.heading}</span>
            <span className="small clamp-2 text-foreground">{item.snippet}</span>
            <span className="mt-1">
              <SimilarityBar similarity={item.similarity} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function RelatedSkeleton() {
  return (
    <div aria-label="Loading related thoughts" className="flex flex-col gap-5">
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex flex-col gap-2">
          <span className="sk block h-2.5 w-[35%]" />
          <span className="sk block h-4 w-[80%]" />
          <span className="sk block h-2.5 w-full" />
        </div>
      ))}
    </div>
  );
}
