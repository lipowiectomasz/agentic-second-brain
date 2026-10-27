import { z } from "zod";

const projectId = z.string().regex(/^[a-z0-9-]{1,36}$/);
const namespace = z.string().regex(/^[a-z][a-z0-9_]{2,30}$/);

export const serverEnvSchema = z.object({
  APPWRITE_ENDPOINT: z.url(),
  APPWRITE_INTERNAL_ENDPOINT: z.url().optional(),
  APPWRITE_PROJECT_ID: projectId,
  APPWRITE_API_KEY: z.string().min(32),
  CORTEX_DATABASE_NAMESPACE: namespace,
  CORTEX_TEST_DATABASE_NAMESPACE: z.string().regex(/^[a-z][a-z0-9_]{2,30}_test$/),
  CORTEX_MAX_PENDING_PROPOSALS: z.coerce.number().int().min(1).max(1000).default(20),
  APP_URL: z.url(),
  CORTEX_EMBEDDING_PREFIX_MODE: z.enum(["none", "nomic"]).default("none"),
  GITHUB_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_APPWRITE_ENDPOINT: z.url(),
  NEXT_PUBLIC_APPWRITE_PROJECT_ID: projectId,
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export class EnvValidationError extends Error {
  constructor(readonly variables: string[]) {
    super(`Invalid or missing environment variables: ${variables.join(", ")}`);
    this.name = "EnvValidationError";
  }
}

function parseEnv<Schema extends z.ZodType>(schema: Schema, source: NodeJS.ProcessEnv): z.infer<Schema> {
  const result = schema.safeParse(withoutEmptyValues(source));
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => String(issue.path[0] ?? "unknown")))];
    throw new EnvValidationError(names.sort());
  }
  return result.data;
}

function withoutEmptyValues(source: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(source).filter((entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== ""),
  );
}

export function loadServerEnv(source: NodeJS.ProcessEnv): ServerEnv {
  return parseEnv(serverEnvSchema, source);
}

export function loadPublicEnv(source: NodeJS.ProcessEnv): PublicEnv {
  return parseEnv(publicEnvSchema, source);
}
