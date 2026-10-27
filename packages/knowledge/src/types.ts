import { z } from "zod";
import type { DocumentStatus, SecretFinding } from "@cortex/core";
import { documentStatuses } from "@cortex/core";

const sectorIdSchema = z.string().regex(/^[a-z0-9-]{1,36}$/);
const segment = /^[A-Za-z0-9._-]+$/;

export const knowledgePathSchema = z
  .string()
  .min(4)
  .max(512)
  .refine((path) => path.endsWith(".md"), { message: "not_markdown" })
  .refine((path) => !path.startsWith("/") && path.split("/").every((part) => segment.test(part) && part !== "." && part !== ".."), {
    message: "unsafe_path",
  });

export const ingestInputSchema = z.object({
  sectorId: sectorIdSchema,
  path: knowledgePathSchema,
  content: z.string().refine((content) => !content.includes("\u0000"), { message: "nul_byte" }),
  baseVersion: z.number().int().min(1).nullable(),
  baseHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  declared: z
    .object({
      supersedes: z.string().regex(/^(SPEC|TASK)-\d{3,4}$/).optional(),
      relatesTo: z.string().regex(/^(SPEC|TASK|FINDING)-\d{3,4}$/).optional(),
    })
    .default({}),
  updatedAt: z.iso.datetime().optional(),
});
export type IngestInput = z.input<typeof ingestInputSchema>;
export type ParsedIngestInput = z.infer<typeof ingestInputSchema>;

export interface IngestResult {
  status: "created" | "updated" | "merged" | "overwritten" | "unchanged";
  fileId: string;
  version: number;
  chunkCount: number;
  docId: string | null;
  docStatus: DocumentStatus | null;
  overwrittenVersion: number | null;
  content: string | null;
}

export const deleteInputSchema = z.object({ sectorId: sectorIdSchema, path: knowledgePathSchema, baseVersion: z.number().int().min(1) });
export type DeleteInput = z.infer<typeof deleteInputSchema>;
export interface DeleteResult {
  status: "deleted" | "kept_changed" | "not_found";
  currentVersion: number | null;
}

export const reserveInputSchema = z.object({ sectorId: sectorIdSchema, kind: z.enum(["spec", "backlog", "finding"]) });
export type ReserveInput = z.infer<typeof reserveInputSchema>;
export interface Reservation {
  docId: string;
  expiresAt: string;
}

export const statusInputSchema = z.object({
  sectorId: sectorIdSchema,
  docId: z.string().regex(/^(SPEC|TASK|FINDING)-\d{3,4}$/),
  status: z.enum(documentStatuses),
});
export type StatusInput = z.infer<typeof statusInputSchema>;
export interface StatusResult {
  docId: string;
  status: DocumentStatus;
  superseded: string | null;
}

export type ForbiddenReason = "token_scope" | "role" | "spine_requires_proposal" | "memory_owner";

export type KnowledgeErrorCode =
  | "invalid_input"
  | "forbidden"
  | "not_author"
  | "sector_not_found"
  | "doc_not_found"
  | "not_found"
  | "immutable"
  | "doc_id_taken"
  | "invalid_transition"
  | "secret_detected"
  | "too_large"
  | "too_many_chunks"
  | "embedding_failed"
  | "storage_failed"
  | "busy";

export type KnowledgeErrorDetails =
  | { code: "forbidden"; reason: ForbiddenReason }
  | { code: "immutable"; docId: string | null; status: DocumentStatus | null }
  | { code: "doc_id_taken"; docId: string }
  | { code: "invalid_transition"; from: DocumentStatus | null; to: DocumentStatus }
  | { code: "secret_detected"; findings: SecretFinding[] }
  | { code: "too_large"; bytes: number; limit: number }
  | { code: "too_many_chunks"; chunks: number; limit: number }
  | { code: "invalid_input"; issues: string[] }
  | { code: "not_author" | "sector_not_found" | "doc_not_found" | "not_found" | "embedding_failed" | "storage_failed" | "busy" };

export class KnowledgeError extends Error {
  constructor(readonly details: KnowledgeErrorDetails) {
    super(`Knowledge operation failed: ${details.code}`);
    this.name = "KnowledgeError";
  }

  get code(): KnowledgeErrorCode {
    return this.details.code;
  }
}

export function invalidInput(...issues: string[]): KnowledgeError {
  return new KnowledgeError({ code: "invalid_input", issues });
}

export const knowledgeHttpStatus: Record<KnowledgeErrorCode, number> = {
  invalid_input: 400,
  forbidden: 403,
  not_author: 403,
  sector_not_found: 404,
  doc_not_found: 404,
  not_found: 404,
  immutable: 409,
  doc_id_taken: 409,
  invalid_transition: 409,
  too_large: 413,
  too_many_chunks: 413,
  secret_detected: 422,
  embedding_failed: 502,
  storage_failed: 503,
  busy: 503,
};
