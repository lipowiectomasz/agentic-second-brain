import { z } from "zod";
import { fileKindSchema } from "@cortex/gateway-contract";

const sectorSlug = z.string().regex(/^[a-z0-9-]{1,64}$/);

export const searchBrainInput = {
  query: z.string().trim().min(1).max(500).describe("Question or topic in natural language"),
  sector: sectorSlug.optional().describe("Limit to one sector slug"),
  kind: fileKindSchema.optional().describe("Limit to one kind of knowledge"),
  includeSuperseded: z.boolean().default(false).describe("Also return superseded or deprecated documents"),
  limit: z.number().int().min(1).max(10).default(5),
};

export const relatedInput = {
  sector: sectorSlug.optional().describe("Sector slug of the file"),
  path: z.string().max(512).optional().describe("Path of the file inside its sector"),
  fileId: z.string().max(36).optional().describe("fileId from a search hit"),
  limit: z.number().int().min(1).max(10).default(5),
};

export const readFileInput = {
  sector: sectorSlug.optional().describe("Sector slug of the file"),
  path: z.string().max(512).optional().describe("Path of the file inside its sector"),
  fileId: z.string().max(36).optional().describe("fileId from a search hit"),
  offset: z.number().int().min(0).default(0).describe("Character offset; use nextOffset from the previous page"),
};

export const hitOutput = z.object({
  sector: z.string(),
  path: z.string(),
  heading: z.string(),
  similarity: z.number(),
  snippet: z.string(),
  fileId: z.string(),
  docId: z.string().nullable(),
  status: z.string().nullable(),
});

export type Hit = z.infer<typeof hitOutput>;

export const hitsOutput = { results: z.array(hitOutput) };

export const fileOutput = {
  sector: z.string(),
  path: z.string(),
  version: z.number(),
  content: z.string(),
  offset: z.number(),
  nextOffset: z.number().nullable(),
  totalLength: z.number(),
};
