import { routes } from "@cortex/gateway-contract";
import { search } from "@cortex/knowledge";
import { route } from "../router";
import { readDeps } from "./deps";

export const searchRoute = route(routes.search, async (ctx, input) => {
  const results = await search(readDeps(ctx), input);
  return {
    results: results.map((result) => ({
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
    })),
  };
});
