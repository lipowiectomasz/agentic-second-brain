import Link from "next/link";
import { Suspense } from "react";
import { getBrainGraph } from "@cortex/knowledge";
import { BrainMap } from "@/components/map/brain-map";
import { requireCaller } from "@/lib/auth/caller";
import { fileVectorCache } from "@/lib/file-vector-cache";
import { getReadDeps } from "@/lib/knowledge";
import { listMySectors } from "@/lib/sectors";

async function MapSection() {
  const caller = await requireCaller("/");
  let graph;
  try {
    const sectors = await listMySectors(caller);
    graph = await getBrainGraph(await getReadDeps(), fileVectorCache, { readableSectorIds: sectors.map((sector) => sector.id), now: new Date() });
  } catch {
    return (
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="card flex max-w-[400px] flex-col items-center gap-3 p-7 text-center" role="alert">
          <h2 className="serif text-[22px] leading-7">The map couldn’t be drawn</h2>
          <p className="small muted">Your files are safe. This is a connection problem on our side.</p>
          <Link href="/" className="btn btn-secondary">
            Try again
          </Link>
        </div>
      </div>
    );
  }
  if (graph.files.length === 0 && !graph.sectors.some((sector) => sector.locked)) {
    return (
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="card flex max-w-[440px] flex-col items-center gap-3 p-8 text-center">
          <h2 className="serif text-2xl leading-[30px]">The notebook is empty</h2>
          <p className="small muted">Push standards, specs and findings from any repository. Cortex reads them and draws the links.</p>
          <code className="mono sunken rounded-sm border border-border px-3 py-2 text-sm">cortex push</code>
          <Link className="small text-accent underline" href="/settings/tokens">
            Get a CLI token
          </Link>
        </div>
      </div>
    );
  }
  return <BrainMap graph={graph} />;
}

export default function HomePage() {
  return (
    <main className="dot-grid relative h-[calc(100vh-56px)] min-h-[560px] flex-1 overflow-hidden">
      <Suspense
        fallback={
          <div className="map-stage" aria-busy="true" aria-label="Loading map">
            <p className="folio absolute top-[62%] left-1/2 -translate-x-1/2">Laying out the notebook…</p>
          </div>
        }
      >
        <MapSection />
      </Suspense>
    </main>
  );
}
