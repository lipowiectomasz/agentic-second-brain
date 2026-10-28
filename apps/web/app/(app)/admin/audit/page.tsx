import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TablesDB } from "node-appwrite";
import { getAccessMatrix, listSectorSummaries } from "@cortex/access";
import { auditFilterSchema, listAuditEvents } from "@cortex/audit";
import { databaseIds } from "@cortex/config";
import { AdminNav } from "@/components/admin/admin-nav";
import { AuditFilters } from "@/components/admin/audit-filters";
import { PageHeader } from "@/components/page-header";
import { SectorBadge } from "@/components/sectors/sector-badge";
import { getAccessDeps } from "@/lib/access-deps";
import { actionLabels, actionTone, relativeTime } from "@/lib/audit-labels";
import { requireOrgAdmin } from "@/lib/auth/caller";
import { getSessionClient } from "@/lib/auth/session-client";
import { serverEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Audit log" };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function AuditLog({ searchParams }: { searchParams: PageProps<"/admin/audit">["searchParams"] }) {
  const caller = await requireOrgAdmin("/admin/audit");
  const raw = await searchParams;
  const parsed = auditFilterSchema.safeParse({ actorId: first(raw.actorId), sectorId: first(raw.sectorId), action: first(raw.action), cursor: first(raw.cursor) });
  const filter = parsed.success ? parsed.data : {};
  const deps = getAccessDeps();
  const ids = databaseIds(serverEnv().CORTEX_DATABASE_NAMESPACE);
  const [page, sectors, matrix] = await Promise.all([listAuditEvents(new TablesDB(await getSessionClient()), ids, filter), listSectorSummaries(caller, deps), getAccessMatrix(caller, deps)]);
  const sectorById = new Map(sectors.map((sector) => [sector.id, sector]));
  const now = new Date();
  const next = new URLSearchParams(Object.entries({ ...filter, cursor: page.nextCursor ?? undefined }).filter((entry): entry is [string, string] => entry[1] !== undefined));
  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={null}>
        <AuditFilters people={matrix.rows.map((row) => ({ id: row.userId, name: row.name }))} sectors={sectors.map((sector) => ({ id: sector.id, name: sector.name }))} />
      </Suspense>
      {page.events.length === 0 ? (
        <p className="card small muted p-8 text-center">No events match these filters.</p>
      ) : (
        <div className="tbl-box">
          <table className="tbl min-w-[900px]">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Event</th>
                <th>Sector</th>
                <th>Object</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {page.events.map((event) => {
                const sector = event.sectorId === undefined ? undefined : sectorById.get(event.sectorId);
                return (
                  <tr key={event.id}>
                    <td className="small muted whitespace-nowrap" title={event.createdAt}>
                      {relativeTime(event.createdAt, now)}
                    </td>
                    <td className="small whitespace-nowrap">
                      {event.actorName}
                      {event.channel === "token" && <span className="xsmall muted"> · CLI</span>}
                    </td>
                    <td>
                      <span className={`badge ${actionTone(event.action)}`}>{actionLabels[event.action]}</span>
                    </td>
                    <td>{sector === undefined ? <span className="xsmall muted">{event.sectorId ?? ""}</span> : <SectorBadge name={sector.name} color={sector.color} />}</td>
                    <td className="mono xsmall break-all">{event.target}</td>
                    <td className="small muted">{event.detail ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {page.nextCursor !== null && (
        <Link href={`/admin/audit?${next.toString()}`} className="btn btn-secondary self-start">
          Next page
        </Link>
      )}
    </div>
  );
}

export default function AuditPage(props: PageProps<"/admin/audit">) {
  return (
    <main className="page">
      <PageHeader folio="Admin" title="Audit log" />
      <AdminNav />
      <Suspense fallback={<span className="sk block h-64 w-full" />}>
        <AuditLog searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
