import Link from "next/link";

export function FileHeaderActions({ proposeHref }: { proposeHref?: string }) {
  if (proposeHref === undefined) return null;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link href={proposeHref} className="btn btn-secondary btn-sm">
        Propose a change
      </Link>
      <span className="xsmall muted">Only org admins edit the spine. Anyone can propose.</span>
    </div>
  );
}
