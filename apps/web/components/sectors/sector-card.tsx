import type { SectorView } from "@cortex/access";
import { RequestAccessButton } from "./request-access-button";
import { SectorSwatch } from "./sector-swatch";

const roleLabels = { "spine-reader": "Reader", reader: "Reader", maintainer: "Maintainer" } as const;

function formatDate(value: string | null): string {
  return value === null ? "" : new Date(value).toISOString().slice(0, 10);
}

export function SectorCard({ sector }: { sector: SectorView }) {
  const locked = sector.myRole === null;
  return (
    <article className="flex flex-col gap-2 rounded-lg border p-4" aria-label={sector.name}>
      <h2 className="flex items-center gap-2 font-semibold">
        <SectorSwatch color={sector.color} locked={locked} />
        {sector.name}
      </h2>
      <p className="text-sm">{sector.kind === "spine" ? "Shared by the whole organisation" : (sector.description ?? "")}</p>
      {sector.myRole !== null ? (
        <p className="text-sm">Your role: {roleLabels[sector.myRole]}</p>
      ) : sector.myRequest?.status === "pending" ? (
        <p className="text-sm">Request pending</p>
      ) : (
        <>
          <p className="text-sm">
            No access
            {sector.myRequest?.status === "rejected" && ` (request rejected ${formatDate(sector.myRequest.decidedAt)})`}
          </p>
          <RequestAccessButton sectorId={sector.id} sectorName={sector.name} />
        </>
      )}
    </article>
  );
}
