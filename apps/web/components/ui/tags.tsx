import type { IconName } from "./icon";
import { Icon } from "./icon";

export type ProposalStatus = "pending" | "accepted" | "rejected" | "withdrawn";

const proposalStatuses: Record<ProposalStatus, { label: string; tone: string; icon: IconName; stroke: number }> = {
  pending: { label: "Pending", tone: "badge-warning", icon: "pending", stroke: 2.4 },
  accepted: { label: "Accepted", tone: "badge-success", icon: "check", stroke: 2 },
  rejected: { label: "Rejected", tone: "badge-danger", icon: "cross", stroke: 1.8 },
  withdrawn: { label: "Withdrawn", tone: "badge-muted", icon: "withdrawn", stroke: 1.6 },
};

export function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
  const badge = proposalStatuses[status];
  return (
    <span className={`badge ${badge.tone}`}>
      <Icon name={badge.icon} size={11} strokeWidth={badge.stroke} />
      {badge.label}
    </span>
  );
}

export function KindTag({ kind }: { kind: "standard" | "procedure" }) {
  return (
    <span className="badge badge-kind font-sans">
      <Icon name={kind} size={12} strokeWidth={1.5} />
      {kind === "standard" ? "Standard" : "Procedure"}
    </span>
  );
}

export function ChangeTag({ change }: { change: "new" | "change" }) {
  return <span className={`tag ${change === "new" ? "tag-new" : "tag-change"}`}>{change === "new" ? "New" : "Change"}</span>;
}
