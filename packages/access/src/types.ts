import type { TablesDB, Teams, Users } from "node-appwrite";
import { z } from "zod";
import type { AuditSink } from "@cortex/audit";
import type { SectorKind, SectorRole } from "@cortex/core";
import { sectorColorTokens, sectorRoles } from "@cortex/core";

export const sectorInputSchema = z.object({
  name: z.string().trim().min(1).max(128),
  slug: z
    .string()
    .regex(/^[a-z0-9-]{2,64}$/)
    .refine((slug) => slug !== "spine", { message: "reserved" }),
  description: z.string().trim().max(512).optional(),
  color: z.enum(sectorColorTokens),
});
export type SectorInput = z.infer<typeof sectorInputSchema>;

export const roleChangeSchema = z.object({
  userId: z.string().min(1).max(36),
  sectorId: z.string().min(1).max(36),
  role: z.enum(sectorRoles).nullable(),
});
export type RoleChange = z.infer<typeof roleChangeSchema>;

export const accessRequestInputSchema = z.object({
  sectorId: z.string().min(1).max(36),
  role: z.enum(sectorRoles),
  message: z.string().trim().max(280).optional(),
});
export type AccessRequestInput = z.infer<typeof accessRequestInputSchema>;

export const requestDecisionSchema = z.object({
  requestId: z.string().min(1).max(36),
  decision: z.enum(["approve", "reject"]),
});
export type RequestDecision = z.infer<typeof requestDecisionSchema>;

export interface SectorRow {
  id: string;
  slug: string;
  name: string;
  kind: SectorKind;
  teamId: string;
  color: string;
  description: string | null;
}

export interface SectorView {
  id: string;
  slug: string;
  name: string;
  kind: SectorKind;
  color: string;
  description: string | null;
  myRole: SectorRole | "spine-reader" | null;
  myRequest: { status: "pending" | "rejected"; decidedAt: string | null } | null;
}

export interface SectorSummary extends SectorView {
  fileCount: number;
  memberCount: number;
  lastChangeAt: string | null;
}

export interface MatrixRow {
  userId: string;
  name: string;
  email: string;
  isOrgAdmin: boolean;
  roles: Record<string, SectorRole | null>;
}

export interface AccessMatrix {
  sectors: Array<Pick<SectorView, "id" | "slug" | "name" | "color">>;
  rows: MatrixRow[];
}

export interface PendingRequest {
  id: string;
  userName: string;
  sector: Pick<SectorView, "id" | "name" | "color">;
  role: SectorRole;
  message: string | null;
  createdAt: string;
}

export interface AccessDeps {
  admin: { tables: TablesDB; teams: Teams; users: Users };
  ids: { tables: string };
  audit: AuditSink;
  includeTestIdentities: boolean;
}
