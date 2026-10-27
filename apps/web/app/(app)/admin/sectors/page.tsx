import { Suspense } from "react";
import { listSectorSummaries } from "@cortex/access";
import { CreateSectorForm } from "@/components/admin/create-sector-form";
import { SectorSwatch } from "@/components/sectors/sector-swatch";
import { getAccessDeps } from "@/lib/access-deps";
import { requireOrgAdmin } from "@/lib/auth/caller";

async function SectorAdministration() {
  const caller = await requireOrgAdmin("/admin/sectors");
  const sectors = await listSectorSummaries(caller, getAccessDeps());
  return (
    <>
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-2">Sector</th>
            <th>Slug</th>
            <th>Files</th>
            <th>Members</th>
            <th>Last change</th>
          </tr>
        </thead>
        <tbody>
          {sectors.map((sector) => (
            <tr key={sector.id} className="border-t">
              <td className="py-2">
                <span className="inline-flex items-center gap-2">
                  <SectorSwatch color={sector.color} />
                  {sector.name}
                </span>
              </td>
              <td className="font-mono">{sector.slug}</td>
              <td>{sector.fileCount}</td>
              <td>{sector.kind === "spine" ? "Everyone" : sector.memberCount}</td>
              <td>{sector.lastChangeAt === null ? "Never" : new Date(sector.lastChangeAt).toISOString().slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <CreateSectorForm />
    </>
  );
}

export default function AdminSectorsPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">Sectors</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <SectorAdministration />
      </Suspense>
    </main>
  );
}
