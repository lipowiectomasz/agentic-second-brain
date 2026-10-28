import { z } from "zod";
import { documentStatuses } from "@cortex/core/document-status";
import { fileKinds } from "@cortex/core/file-kind";
import { okBody } from "./envelope";

export const fileKindSchema = z.enum(fileKinds);
const docIdSchema = z.string().regex(/^[A-Z]+-\d{3,4}$/);
const sectorIdSchema = z.string().regex(/^[a-z0-9-]{1,36}$/);

export const documentMetaSchema = z.object({
  docId: docIdSchema.nullable(),
  status: z.enum(documentStatuses).nullable(),
  supersedes: z.string().nullable(),
  supersededBy: z.string().nullable(),
  relatesTo: z.string().nullable(),
  authorId: z.string(),
});

export type DocumentMeta = z.infer<typeof documentMetaSchema>;

export const fileEntrySchema = z.object({
  fileId: z.string(),
  sectorId: z.string(),
  path: z.string().max(512),
  kind: fileKindSchema,
  version: z.number().int().min(1),
  hash: z.string().length(64),
  size: z.number().int().min(0),
  title: z.string().max(256),
  updatedAt: z.iso.datetime({ offset: true }),
  meta: documentMetaSchema,
});

export type FileEntry = z.infer<typeof fileEntrySchema>;

export const manifestSectorSchema = z.object({
  id: z.string(),
  slug: z.string().regex(/^[a-z0-9-]{1,64}$/),
  name: z.string(),
  kind: z.enum(["spine", "project"]),
  role: z.enum(["reader", "maintainer", "admin"]),
});

export type ManifestSector = z.infer<typeof manifestSectorSchema>;

export const manifestDataSchema = z.object({
  authorSlug: z.string(),
  sectors: z.array(manifestSectorSchema),
  files: z.array(fileEntrySchema).max(5000),
});

export type ManifestData = z.infer<typeof manifestDataSchema>;

export const pushRejectionSchema = z.enum(["immutable", "not_author", "forbidden", "secret_detected", "too_large", "invalid_path"]);

export const pushOutcomeSchema = z.discriminatedUnion("result", [
  z.object({ result: z.enum(["created", "updated", "unchanged"]), file: fileEntrySchema }),
  z.object({ result: z.literal("merged"), file: fileEntrySchema, content: z.string() }),
  z.object({ result: z.literal("overwritten"), file: fileEntrySchema, content: z.string(), overwrittenVersion: z.number().int().min(1) }),
  z.object({ result: z.literal("rejected"), reason: pushRejectionSchema, docId: z.string().nullable(), line: z.number().int().nullable(), secretKind: z.string().nullable() }),
]);

export type PushOutcome = z.infer<typeof pushOutcomeSchema>;

export const searchHitSchema = z.object({
  sectorId: z.string(),
  sectorName: z.string(),
  fileId: z.string(),
  path: z.string(),
  title: z.string(),
  kind: fileKindSchema,
  heading: z.string(),
  snippet: z.string(),
  similarity: z.number().min(0).max(1),
  docId: z.string().nullable(),
  status: z.string(),
});

export type SearchHit = z.infer<typeof searchHitSchema>;

export const syncRoutes = {
  manifest: { path: "/v1/manifest", access: "read", input: z.object({}).strict(), output: okBody(manifestDataSchema) },
  filesContent: { path: "/v1/files/content", access: "read", input: z.object({ fileId: z.string().min(1).max(36) }).strict(), output: okBody(fileEntrySchema.extend({ content: z.string() })) },
  filesPush: {
    path: "/v1/files/push",
    access: "write",
    input: z
      .object({
        sectorId: sectorIdSchema,
        path: z.string().min(4).max(512),
        content: z.string().max(262144),
        baseVersion: z.number().int().min(1).nullable(),
        baseHash: z.string().length(64).nullable(),
        declared: z.object({ supersedes: docIdSchema.nullable(), relatesTo: docIdSchema.nullable() }),
      })
      .strict(),
    output: okBody(pushOutcomeSchema),
  },
  filesDelete: {
    path: "/v1/files/delete",
    access: "write",
    input: z.object({ sectorId: sectorIdSchema, path: z.string().min(4).max(512), baseVersion: z.number().int().min(1) }).strict(),
    output: okBody(
      z.discriminatedUnion("result", [
        z.object({ result: z.enum(["deleted", "not_found"]) }),
        z.object({ result: z.literal("kept_changed"), currentVersion: z.number().int().nullable() }),
        z.object({ result: z.literal("rejected"), reason: z.enum(["immutable", "not_author", "forbidden"]) }),
      ]),
    ),
  },
  docsReserve: {
    path: "/v1/docs/reserve",
    access: "write",
    input: z.object({ sectorId: sectorIdSchema, kind: z.enum(["spec", "backlog", "finding"]) }).strict(),
    output: okBody(z.object({ docId: z.string(), reservedUntil: z.string() })),
  },
  docsStatus: {
    path: "/v1/docs/status",
    access: "write",
    input: z.object({ sectorId: sectorIdSchema, docId: docIdSchema, status: z.enum(["draft", "approved", "in_progress", "implemented", "deprecated"]) }).strict(),
    output: okBody(z.object({ docId: z.string(), status: z.enum(documentStatuses), superseded: z.string().nullable() })),
  },
  search: {
    path: "/v1/search",
    access: "read",
    input: z
      .object({
        query: z.string().trim().min(1).max(500),
        sectorIds: z.array(sectorIdSchema).max(50).optional(),
        kinds: z.array(fileKindSchema).optional(),
        includeSuperseded: z.boolean().default(false),
        limit: z.number().int().min(1).max(20).default(8),
      })
      .strict(),
    output: okBody(z.object({ results: z.array(searchHitSchema) })),
  },
} as const;
