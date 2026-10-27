import { ID, Permission, Query, Role, TablesDB, Teams, VectorsDB } from "node-appwrite";
import { noopAuditSink } from "@cortex/audit";
import { databaseIds, loadServerEnv } from "@cortex/config";
import { createAppwriteEmbedder, ingestFile } from "@cortex/knowledge";
import { createAdminClient, toCaller } from "@cortex/server-kit";

export const e2eSectorId = "e2e-knowledge";
export const e2eTeamId = `sector-${e2eSectorId}`;

const corpus: Array<[string, string]> = [
  ["notes/rollback.md", "# Rolling back a failed deployment\n\nWhen a release breaks production, redeploy the previous container image tag and restore the database snapshot taken before the migration.\n\n## Checklist\n\nAnnounce the rollback in the team channel and open an incident note.\n"],
  ["notes/release-revert.md", "# Reverting a broken release\n\nIf the new version crashes, switch traffic back to the last healthy build and keep the faulty one for analysis.\n"],
  ["notes/caching.md", "# Cache invalidation\n\nPurge the CDN cache after changing product images, otherwise customers keep seeing the old pictures for hours.\n"],
];

function context() {
  const env = loadServerEnv(process.env);
  return { env, admin: createAdminClient(env), ids: databaseIds(env.CORTEX_DATABASE_NAMESPACE) };
}

export async function seedKnowledge(memberIds: string[]): Promise<void> {
  const { admin, ids } = context();
  await removeKnowledge();
  await new Teams(admin).create({ teamId: e2eTeamId, name: "e2e-knowledge", roles: ["maintainer", "reader"] });
  await new TablesDB(admin).createRow({
    databaseId: ids.tables,
    tableId: "sectors",
    rowId: e2eSectorId,
    data: { slug: e2eSectorId, name: "E2E Knowledge", kind: "project", teamId: e2eTeamId, color: "#1d6f70" },
    permissions: [Permission.read(Role.users())],
  });
  for (const userId of memberIds) await new Teams(admin).createMembership({ teamId: e2eTeamId, userId, roles: ["reader"] });
  const deps = {
    admin,
    ids,
    access: { getSectorRole: async () => "maintainer" as const },
    audit: noopAuditSink,
    embedder: createAppwriteEmbedder(admin),
    newId: () => ID.unique(),
    now: () => new Date(),
  };
  const writer = toCaller({ $id: "e2e-writer", name: "e2e-writer", email: "e2e-writer@example.com", labels: ["admin"] }, "web");
  for (const [path, content] of corpus) {
    await ingestFile(deps, writer, { sectorId: e2eSectorId, path, content, baseVersion: null, baseHash: null });
  }
}

export async function removeKnowledge(): Promise<void> {
  const { admin, ids } = context();
  const tables = new TablesDB(admin);
  await tables.deleteRows({ databaseId: ids.tables, tableId: "files", queries: [Query.equal("sectorId", [e2eSectorId])] }).catch(() => undefined);
  await new VectorsDB(admin).deleteDocuments({ databaseId: ids.vectors, collectionId: "chunks", queries: [Query.equal("metadata.sectorId", [e2eSectorId])] }).catch(() => undefined);
  await tables.deleteRow({ databaseId: ids.tables, tableId: "sectors", rowId: e2eSectorId }).catch(() => undefined);
  await new Teams(admin).delete({ teamId: e2eTeamId }).catch(() => undefined);
}
