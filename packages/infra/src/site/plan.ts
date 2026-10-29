import { createHash } from "node:crypto";
import type { ServerEnv } from "@cortex/config";

export const siteId = "cortex-web";
export const bundleHashKey = "CORTEX_BUNDLE_HASH";
export const secretHashKey = "CORTEX_SECRET_HASH";
export const secretKeys = ["APPWRITE_API_KEY", "GITHUB_OAUTH_CLIENT_SECRET"] as const;

export interface SiteSettings {
  framework: "nextjs";
  adapter: "ssr";
  buildRuntime: "node-22";
  installCommand: string;
  buildCommand: string;
  outputDirectory: string;
  timeout: number;
}

export const siteSettings: SiteSettings = {
  framework: "nextjs",
  adapter: "ssr",
  buildRuntime: "node-22",
  installCommand: "npm ci --no-audit --no-fund",
  buildCommand: "npm run build -w @cortex/web",
  outputDirectory: "./apps/web/.next",
  timeout: 30,
};

export interface SiteEnv {
  CORTEX_SITE_DOMAIN: string;
  CORTEX_SITE_URL: string;
  CORTEX_FUNCTION_API_ENDPOINT: string;
  NEXT_PUBLIC_APPWRITE_ENDPOINT: string;
  NEXT_PUBLIC_APPWRITE_PROJECT_ID: string;
}

export interface SiteVariable {
  $id: string;
  key: string;
  value: string;
  secret: boolean;
}

export interface VariableChanges {
  create: string[];
  update: Array<{ id: string; key: string }>;
}

export function siteVariables(env: ServerEnv, site: SiteEnv): Record<string, string> {
  const variables: Record<string, string> = {
    APPWRITE_ENDPOINT: env.APPWRITE_ENDPOINT,
    APPWRITE_INTERNAL_ENDPOINT: site.CORTEX_FUNCTION_API_ENDPOINT,
    APPWRITE_PROJECT_ID: env.APPWRITE_PROJECT_ID,
    APPWRITE_API_KEY: env.APPWRITE_API_KEY,
    CORTEX_DATABASE_NAMESPACE: env.CORTEX_DATABASE_NAMESPACE,
    CORTEX_TEST_DATABASE_NAMESPACE: env.CORTEX_TEST_DATABASE_NAMESPACE,
    CORTEX_MAX_PENDING_PROPOSALS: String(env.CORTEX_MAX_PENDING_PROPOSALS),
    CORTEX_EMBEDDING_PREFIX_MODE: env.CORTEX_EMBEDDING_PREFIX_MODE,
    APP_URL: site.CORTEX_SITE_URL,
    NEXT_PUBLIC_APPWRITE_ENDPOINT: site.NEXT_PUBLIC_APPWRITE_ENDPOINT,
    NEXT_PUBLIC_APPWRITE_PROJECT_ID: site.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
  };
  if (env.GITHUB_OAUTH_CLIENT_ID !== undefined) variables.GITHUB_OAUTH_CLIENT_ID = env.GITHUB_OAUTH_CLIENT_ID;
  if (env.GITHUB_OAUTH_CLIENT_SECRET !== undefined) variables.GITHUB_OAUTH_CLIENT_SECRET = env.GITHUB_OAUTH_CLIENT_SECRET;
  variables[secretHashKey] = secretHash(variables);
  return variables;
}

export function secretHash(variables: Record<string, string>): string {
  const hash = createHash("sha256");
  for (const key of secretKeys) hash.update(`${key}=${variables[key] ?? ""}\n`);
  return hash.digest("hex");
}

export function isSecretKey(key: string): boolean {
  return (secretKeys as readonly string[]).includes(key);
}

export function variableChanges(desired: Record<string, string>, current: SiteVariable[]): VariableChanges {
  const secretsChanged = current.find((variable) => variable.key === secretHashKey)?.value !== desired[secretHashKey];
  const changes: VariableChanges = { create: [], update: [] };
  for (const [key, value] of Object.entries(desired)) {
    const found = current.find((variable) => variable.key === key);
    if (found === undefined) changes.create.push(key);
    else if (isSecretKey(key) ? secretsChanged || !found.secret : found.value !== value) changes.update.push({ id: found.$id, key });
  }
  return changes;
}

export function settingsDiffer(current: Partial<SiteSettings>): boolean {
  return (Object.keys(siteSettings) as Array<keyof SiteSettings>).some((key) => current[key] !== siteSettings[key]);
}

export function needsDeployment(input: { bundleHash: string; storedHash: string | null; variablesChanged: boolean; activeReady: boolean }): boolean {
  return input.variablesChanged || !input.activeReady || input.storedHash !== input.bundleHash;
}

export type RuleAction = "create" | "exists" | { conflict: string };

export function ruleAction(domain: string, rules: Array<{ domain: string; deploymentResourceType?: string | null; deploymentResourceId: string }>): RuleAction {
  const rule = rules.find((candidate) => candidate.domain === domain);
  if (rule === undefined) return "create";
  if (rule.deploymentResourceType === "site" && rule.deploymentResourceId === siteId) return "exists";
  return { conflict: `${rule.deploymentResourceType ?? "unknown"}:${rule.deploymentResourceId}` };
}

export function logTail(logs: string, lines: number): string {
  return logs.trimEnd().split("\n").slice(-lines).join("\n");
}
