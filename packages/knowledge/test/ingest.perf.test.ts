import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bodyHash } from "@cortex/core";
import { ingestFile } from "../src";
import type { Member } from "./helpers";
import { cleanup, createMember, createProjectSector, sectorId, writeDeps } from "./helpers";

const deps = writeDeps();
let maint: Member;

beforeAll(async () => {
  await createProjectSector();
  maint = await createMember("pmaint", { teamRole: "maintainer" });
});

afterAll(cleanup);

describe("ingestion performance", () => {
  it("adds less than two seconds of pipeline overhead to the model time for a 20 KB file", async () => {
    let modelMs = 0;
    const timed = {
      ...deps,
      embedder: {
        embedQuery: deps.embedder.embedQuery,
        async embedDocuments(items: Parameters<typeof deps.embedder.embedDocuments>[0]) {
          const started = performance.now();
          const vectors = await deps.embedder.embedDocuments(items);
          modelMs += performance.now() - started;
          return vectors;
        },
      },
    };
    await deps.embedder.embedQuery("warm up");
    const large = `# Large\n\n${Array.from({ length: 8 }, (_, index) => `## Part ${index}\n${`Content ${index} for the timing check with a realistic section length. `.repeat(40)}`).join("\n\n")}\n`;
    expect(large.length).toBeGreaterThan(20_000);
    const started = performance.now();
    const result = await ingestFile(timed, maint.caller, { sectorId, path: "notes/large.md", content: large, baseVersion: null, baseHash: null });
    const totalMs = performance.now() - started;
    console.log(`20 KB ingest: total ${Math.round(totalMs)} ms, model ${Math.round(modelMs)} ms, overhead ${Math.round(totalMs - modelMs)} ms`);
    expect(totalMs - modelMs).toBeLessThan(2000);
    expect(result.status).toBe("created");
  });

  it("re-embeds only the changed section when a long file is edited", async () => {
    const sectionsMany = `# Many\n\n${Array.from({ length: 40 }, (_, index) => `## Part ${index}\n${`Content ${index} for the incremental check. `.repeat(14)}`).join("\n\n")}\n`;
    const created = await ingestFile(deps, maint.caller, { sectorId, path: "notes/many.md", content: sectionsMany, baseVersion: null, baseHash: null });
    expect(created.chunkCount).toBe(40);
    const started = performance.now();
    const edited = await ingestFile(deps, maint.caller, { sectorId, path: "notes/many.md", content: sectionsMany.replace("Content 7 for", "Content seven for"), baseVersion: 1, baseHash: bodyHash(sectionsMany) });
    expect(performance.now() - started).toBeLessThan(1500);
    expect(edited).toMatchObject({ status: "updated", chunkCount: 40 });
  });

});
