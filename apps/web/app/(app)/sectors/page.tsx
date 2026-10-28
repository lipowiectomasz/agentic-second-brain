import { Suspense } from "react";
import { TablesDB } from "node-appwrite";
import { listSectorsForCaller } from "@cortex/access";
import { PageHeader } from "@/components/page-header";
import { SectorCard } from "@/components/sectors/sector-card";
import { getAccessDeps } from "@/lib/access-deps";
import { requireCaller } from "@/lib/auth/caller";
import { getSessionClient } from "@/lib/auth/session-client";

async function SectorGrid() {
  const caller = await requireCaller("/sectors");
  const sectors = await listSectorsForCaller(caller, new TablesDB(await getSessionClient()), getAccessDeps());
  return (
    <>
      <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(320px, 100%), 1fr))" }}>
        {sectors.map((sector) => (
          <SectorCard key={sector.id} sector={sector} />
        ))}
      </div>
    </>
  );
}

export default function SectorsPage() {
  return (
    <main className="page">
      <PageHeader folio="Knowledge" title="Sectors">
        <p className="muted max-w-xl">The spine belongs to everyone. Each sector is one project&apos;s notebook - you see the ones your team works in, and can ask for the rest.</p>
      </PageHeader>
      <hr className="rule-double" />
      <Suspense fallback={<div className="sk h-52 w-full" />}>
        <SectorGrid />
      </Suspense>
    </main>
  );
}
