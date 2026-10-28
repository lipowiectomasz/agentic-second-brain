import type { Models } from "node-appwrite";
import { Query, TablesDB } from "node-appwrite";
import { withTimeout } from "@cortex/server-kit";
import type { KnowledgeReadDeps } from "./search";
import { mapReadError } from "./search";
import type { FindingLink } from "./search-types";
import { filesTableId } from "./store";

const docIdPattern = /^[A-Z]+-\d{3,4}$/;
const sectorIdPattern = /^[a-z0-9-]{1,36}$/;

export async function relatedFindings(deps: Pick<KnowledgeReadDeps, "scoped" | "ids">, input: { sectorId: string; docId: string; limit?: number }): Promise<FindingLink[]> {
  if (!docIdPattern.test(input.docId) || !sectorIdPattern.test(input.sectorId)) return [];
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  try {
    const list = await withTimeout("tablesDB.listRows findings", () =>
      new TablesDB(deps.scoped).listRows<Models.Row & { title: string; path: string }>({
        databaseId: deps.ids.tables,
        tableId: filesTableId,
        queries: [Query.equal("sectorId", [input.sectorId]), Query.equal("relatesTo", [input.docId]), Query.equal("kind", ["finding"]), Query.orderDesc("$updatedAt"), Query.select(["$id", "$updatedAt", "title", "path"]), Query.limit(limit)],
      }),
    );
    return list.rows.map((row) => ({ fileId: row.$id, title: row.title, path: row.path, updatedAt: row.$updatedAt }));
  } catch (error) {
    throw mapReadError(error);
  }
}
