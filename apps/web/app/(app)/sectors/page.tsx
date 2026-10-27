import { Suspense } from "react";
import { TablesDB } from "node-appwrite";
import { listSectorsForCaller } from "@cortex/access";
import { SectorCard } from "@/components/sectors/sector-card";
import { getAccessDeps } from "@/lib/access-deps";
import { requireCaller } from "@/lib/auth/caller";
import { getSessionClient } from "@/lib/auth/session-client";

async function SectorGrid() {
  const caller = await requireCaller("/sectors");
  const sectors = await listSectorsForCaller(caller, new TablesDB(await getSessionClient()), getAccessDeps());
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sectors.map((sector) => (
          <SectorCard key={sector.id} sector={sector} />
        ))}
      </div>
    </>
  );
}

export default function SectorsPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">Sectors</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <SectorGrid />
      </Suspense>
    </main>
  );
}
