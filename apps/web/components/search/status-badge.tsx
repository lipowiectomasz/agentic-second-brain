const badges: Record<string, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "badge-muted" },
  approved: { label: "Approved", tone: "badge-info" },
  in_progress: { label: "In progress", tone: "badge-warning" },
  implemented: { label: "Implemented", tone: "badge-success" },
  superseded: { label: "Superseded", tone: "badge-danger" },
  deprecated: { label: "Deprecated", tone: "badge-danger" },
};

export function StatusBadge({ status }: { status: string | null }) {
  const badge = status === null ? undefined : badges[status];
  if (badge === undefined) return null;
  return <span className={`badge ${badge.tone}`}>{badge.label}</span>;
}
