import { z } from "zod";

export const proposalStatuses = ["pending", "accepting", "accepted", "rejected", "withdrawn"] as const;
export type ProposalStatus = (typeof proposalStatuses)[number];
export type ProposalKind = "standard" | "procedure";
export type ProposalOutcome = "created" | "updated" | "merged" | "overwritten" | "unchanged";

export const maxContentBytes = 262144;

export const submitProposalSchema = z.object({
  kind: z.enum(["standard", "procedure"]),
  targetPath: z.string().trim().min(4).max(512),
  baseVersion: z.number().int().min(1).nullable(),
  title: z.string().trim().min(1).max(200),
  rationale: z.string().trim().min(1).max(4000),
  content: z.string().min(1),
  source: z.object({ sectorId: z.string().regex(/^[a-z0-9-]{1,36}$/), path: z.string().max(512) }).nullable(),
});

export type SubmitProposalInput = z.infer<typeof submitProposalSchema>;

export const rejectProposalSchema = z.object({ proposalId: z.string().min(1).max(36), note: z.string().trim().min(1).max(1000) });

export interface ProposalSummary {
  id: string;
  proposerId: string;
  proposerName: string;
  kind: ProposalKind;
  title: string;
  targetPath: string;
  isChange: boolean;
  sourceSectorId: string | null;
  sourcePath: string | null;
  status: ProposalStatus;
  createdAt: string;
  decisionNote: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  resultFileId: string | null;
  resultOutcome: ProposalOutcome | null;
  overwrittenVersion: number | null;
}

export interface ProposalDetail extends ProposalSummary {
  rationale: string;
  content: string;
  baseVersion: number | null;
  targetFileId: string | null;
}

export interface DiffRow {
  kind: "add" | "del" | "same";
  oldNumber: number | null;
  newNumber: number | null;
  text: string;
}
