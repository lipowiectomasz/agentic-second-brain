import type { SearchHit } from "@cortex/gateway-contract";
import { routes } from "@cortex/gateway-contract";
import type { SearchResult } from "@cortex/knowledge";
import { related, search } from "@cortex/knowledge";
import { route } from "../router";
import { readDeps } from "./deps";

export function toHit(result: SearchResult): SearchHit {
  return {
    sectorId: result.sectorId,
    sectorName: result.sectorName,
    fileId: result.fileId,
    path: result.path,
    title: result.title,
    kind: result.kind,
    heading: result.heading,
    snippet: result.snippet,
    similarity: result.similarity,
    docId: result.docId,
    status: result.status,
  };
}

export const searchRoute = route(routes.search, async (ctx, input) => ({ results: (await search(readDeps(ctx), input)).map(toHit) }));

export const relatedRoute = route(routes.related, async (ctx, input) => ({ results: (await related(readDeps(ctx), input)).map(toHit) }));
