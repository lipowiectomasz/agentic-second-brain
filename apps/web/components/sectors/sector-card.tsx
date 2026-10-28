import type { SectorView } from "@cortex/access";
import { RequestAccessButton } from "./request-access-button";
import { sectorStyle } from "./sector-badge";

const roleLabels = { "spine-reader": "Reader", reader: "Reader", maintainer: "Maintainer" } as const;

function formatDate(value: string | null): string {
  return value === null ? "" : new Date(value).toISOString().slice(0, 10);
}

export function SectorCard({ sector }: { sector: SectorView }) {
  const locked = sector.myRole === null;
  return (
    <article id={`sector-${sector.id}`} className="card relative flex min-h-[210px] scroll-mt-20 flex-col gap-2.5 px-5 pb-4 pt-6" aria-label={sector.name} style={locked ? undefined : sectorStyle(sector.color)}>
      <span aria-hidden className="absolute -top-px left-5 h-1.5 w-12 rounded-b-sm" style={{ background: locked ? "var(--color-locked)" : "var(--c)" }} />
      <h2 className="serif" style={{ fontSize: 22, lineHeight: "28px" }}>
        {sector.name}
      </h2>
      <p className="small muted line-clamp-3 flex-grow">{sector.kind === "spine" ? "Shared by the whole organisation" : (sector.description ?? "")}</p>
      {sector.myRole !== null ? (
        <p className="small">
          Your role: <span className="badge badge-role">{roleLabels[sector.myRole]}</span>
        </p>
      ) : sector.myRequest?.status === "pending" ? (
        <p className="small">
          <span className="badge badge-warning">Request pending</span>
        </p>
      ) : (
        <>
          <p className="small muted">
            <span className="badge badge-locked">No access</span>
            {sector.myRequest?.status === "rejected" && ` Request rejected ${formatDate(sector.myRequest.decidedAt)}`}
          </p>
          <RequestAccessButton sectorId={sector.id} sectorName={sector.name} />
        </>
      )}
    </article>
  );
}
