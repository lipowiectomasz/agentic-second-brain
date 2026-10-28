import type { AuditAction } from "@cortex/core";

export const actionLabels: Record<AuditAction, string> = {
  "file.upserted": "File updated",
  "file.deleted": "File deleted",
  "file.rejected_secret": "File rejected: secret",
  "sector.created": "Sector created",
  "role.changed": "Role changed",
  "access.requested": "Access requested",
  "access.approved": "Access approved",
  "access.rejected": "Access rejected",
  "token.created": "Token created",
  "token.revoked": "Token revoked",
  "proposal.submitted": "Proposal submitted",
  "proposal.accepted": "Proposal accepted",
  "proposal.rejected": "Proposal rejected",
  "proposal.withdrawn": "Proposal withdrawn",
  "document.status_changed": "Status changed",
};

export const actionGroups: Array<{ label: string; actions: AuditAction[] }> = [
  { label: "Knowledge", actions: ["file.upserted", "file.deleted", "document.status_changed", "sector.created"] },
  { label: "Proposals", actions: ["proposal.submitted", "proposal.accepted", "proposal.rejected", "proposal.withdrawn"] },
  { label: "Access", actions: ["role.changed", "access.requested", "access.approved", "access.rejected"] },
  { label: "Tokens", actions: ["token.created", "token.revoked"] },
  { label: "Security", actions: ["file.rejected_secret"] },
];

export function actionTone(action: AuditAction): "badge-danger" | "badge-info" | "badge-warning" | "badge-muted" | "badge-success" {
  if (action === "file.rejected_secret") return "badge-danger";
  if (action.startsWith("proposal.")) return "badge-info";
  if (action.startsWith("token.")) return "badge-warning";
  if (action.startsWith("access.") || action === "role.changed") return "badge-success";
  return "badge-muted";
}

export function relativeTime(iso: string, now: Date): string {
  const seconds = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
