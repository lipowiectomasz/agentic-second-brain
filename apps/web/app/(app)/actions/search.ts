"use server";

import type { SearchResult } from "@cortex/knowledge";
import { KnowledgeError, search, searchInputSchema } from "@cortex/knowledge";
import { UnauthenticatedError } from "@cortex/server-kit";
import { getReadDeps } from "@/lib/knowledge";

export type SearchActionResult = { ok: true; results: SearchResult[] } | { ok: false; error: "invalid_input" | "unavailable" | "unauthenticated" };

export async function searchAction(input: unknown): Promise<SearchActionResult> {
  const parsed = searchInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  try {
    return { ok: true, results: await search(await getReadDeps(), parsed.data) };
  } catch (error) {
    if (error instanceof UnauthenticatedError || (error instanceof KnowledgeError && error.code === "forbidden")) return { ok: false, error: "unauthenticated" };
    if (error instanceof KnowledgeError && error.code === "invalid_input") return { ok: false, error: "invalid_input" };
    return { ok: false, error: "unavailable" };
  }
}
