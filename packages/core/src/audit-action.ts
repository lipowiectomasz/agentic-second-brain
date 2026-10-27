export const auditActions = [
  "file.upserted",
  "file.deleted",
  "file.rejected_secret",
  "sector.created",
  "role.changed",
  "access.requested",
  "access.approved",
  "access.rejected",
  "token.created",
  "token.revoked",
  "proposal.submitted",
  "proposal.accepted",
  "proposal.rejected",
  "proposal.withdrawn",
  "document.status_changed",
] as const;

export type AuditAction = (typeof auditActions)[number];

export interface AuditEvent {
  actorId: string;
  actorName: string;
  channel: "web" | "token" | "system";
  action: AuditAction;
  sectorId?: string;
  target: string;
  detail?: string;
}
