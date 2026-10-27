import "server-only";
import type { KnowledgeReadDeps, QueryEmbeddingCache } from "@cortex/knowledge";
import { createAppwriteEmbedder, createQueryEmbeddingCache, defaultEmbedderOptions } from "@cortex/knowledge";
import { databaseIds } from "@cortex/config";
import { createAdminClient } from "@cortex/server-kit";
import { getSessionClient } from "@/lib/auth/session-client";
import { serverEnv } from "@/lib/env";

let queryCache: QueryEmbeddingCache | undefined;

export async function getReadDeps(): Promise<KnowledgeReadDeps> {
  const env = serverEnv();
  queryCache ??= createQueryEmbeddingCache({ maxEntries: 200, prefixMode: env.CORTEX_EMBEDDING_PREFIX_MODE });
  return {
    scoped: await getSessionClient(),
    ids: databaseIds(env.CORTEX_DATABASE_NAMESPACE),
    embedder: createAppwriteEmbedder(createAdminClient(env), { ...defaultEmbedderOptions, prefixMode: env.CORTEX_EMBEDDING_PREFIX_MODE }),
    queryCache,
  };
}
