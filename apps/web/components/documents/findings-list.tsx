import Link from "next/link";
import { relatedFindings } from "@cortex/knowledge";
import { SectorBadge } from "@/components/sectors/sector-badge";
import { Icon } from "@/components/ui/icon";
import { shortDate } from "@/lib/dates";
import { getReadDeps } from "@/lib/knowledge";

export async function FindingsList({ sectorId, docId, sector }: { sectorId: string; docId: string; sector: { name: string; color: string } }) {
  let findings;
  try {
    findings = await relatedFindings(await getReadDeps(), { sectorId, docId });
  } catch {
    return null;
  }
  if (findings.length === 0) return null;
  return (
    <section aria-labelledby="findings-heading" className="flex flex-col gap-1.5">
      <h2 id="findings-heading" className="folio">
        Findings · {findings.length}
      </h2>
      <ul className="m-0 flex list-none flex-col p-0">
        {findings.map((finding) => (
          <li key={finding.fileId}>
            <Link href={`/files/${finding.fileId}`} className="flex min-h-11 flex-wrap items-center gap-2.5 border-b border-border py-1.5 text-inherit no-underline hover:text-accent">
              <span className="muted">
                <Icon name="document" size={14} strokeWidth={1.5} />
              </span>
              <span className="small flex-[1_1_200px] font-medium">{finding.title}</span>
              <SectorBadge name={sector.name} color={sector.color} />
              <span className="xsmall muted">{shortDate(finding.updatedAt)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
