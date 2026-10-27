const labels: Record<string, string> = {
  draft: "Draft",
  approved: "Approved",
  in_progress: "In progress",
  implemented: "Implemented",
  superseded: "Superseded",
  deprecated: "Deprecated",
};

export function StatusBadge({ status }: { status: string | null }) {
  if (status === null || labels[status] === undefined) return null;
  return <span className="rounded border px-1.5 py-0.5 text-xs">{labels[status]}</span>;
}
