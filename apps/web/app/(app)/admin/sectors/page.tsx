import { Suspense } from "react";
import { listSectorSummaries } from "@cortex/access";
import { AdminNav } from "@/components/admin/admin-nav";
import { CreateSectorForm } from "@/components/admin/create-sector-form";
import { PageHeader } from "@/components/page-header";
import { SectorBadge } from "@/components/sectors/sector-badge";
import { getAccessDeps } from "@/lib/access-deps";
import { requireOrgAdmin } from "@/lib/auth/caller";

async function SectorAdministration() {
  const caller = await requireOrgAdmin("/admin/sectors");
  const sectors = await listSectorSummaries(caller, getAccessDeps());
  return (
    <>
      <div className="tbl-box">
      <table className="tbl">
        <thead>
          <tr>
            <th>Sector</th>
            <th>Slug</th>
            <th>Files</th>
            <th>Members</th>
            <th>Last change</th>
          </tr>
        </thead>
        <tbody>
          {sectors.map((sector) => (
            <tr key={sector.id}>
              <td>
                <SectorBadge name={sector.name} color={sector.color} />
              </td>
              <td className="mono">{sector.slug}</td>
              <td>{sector.fileCount}</td>
              <td>{sector.kind === "spine" ? "Everyone" : sector.memberCount}</td>
              <td>{sector.lastChangeAt === null ? "Never" : new Date(sector.lastChangeAt).toISOString().slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <CreateSectorForm />
    </>
  );
}

export default function AdminSectorsPage() {
  return (
    <main className="page">
      <PageHeader folio="Admin" title="Sectors" />
      <AdminNav />
      <Suspense fallback={<div className="sk h-48 w-full" />}>
        <SectorAdministration />
      </Suspense>
    </main>
  );
}
