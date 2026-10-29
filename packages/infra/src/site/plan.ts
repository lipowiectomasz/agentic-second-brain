import { createHash } from "node:crypto";
import type { ServerEnv } from "@cortex/config";

export const siteId = "cortex-web";
export const deployedHashKey = "CORTEX_DEPLOYED_HASH";
export const secretHashKey = "CORTEX_SECRET_HASH";
export const secretKeys = ["APPWRITE_API_KEY", "GITHUB_OAUTH_CLIENT_SECRET"] as const;
export const managedKeys = [
  "APPWRITE_ENDPOINT",
  "APPWRITE_INTERNAL_ENDPOINT",
  "APPWRITE_PROJECT_ID",
  "APPWRITE_API_KEY",
  "CORTEX_DATABASE_NAMESPACE",
  "CORTEX_TEST_DATABASE_NAMESPACE",
  "CORTEX_MAX_PENDING_PROPOSALS",
  "CORTEX_EMBEDDING_PREFIX_MODE",
  "APP_URL",
  "NEXT_PUBLIC_APPWRITE_ENDPOINT",
  "NEXT_PUBLIC_APPWRITE_PROJECT_ID",
  "GITHUB_OAUTH_CLIENT_ID",
  "GITHUB_OAUTH_CLIENT_SECRET",
  secretHashKey,
  "CORTEX_BUNDLE_HASH",
] as const;

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
  CORTEX_WEB_API_KEY: string;
  NEXT_PUBLIC_APPWRITE_ENDPOINT: string;
  NEXT_PUBLIC_APPWRITE_PROJECT_ID: string;
}

export interface SiteVariable {
  $id: string;
  key: string;
  value: string;
  secret: boolean;
}

export type VariableOperation = { kind: "create"; key: string } | { kind: "update"; key: string; id: string } | { kind: "remove"; key: string; id: string };

export function siteVariables(env: ServerEnv, site: SiteEnv): Record<string, string> {
  const variables: Record<string, string> = {
    APPWRITE_ENDPOINT: env.APPWRITE_ENDPOINT,
    APPWRITE_INTERNAL_ENDPOINT: site.CORTEX_FUNCTION_API_ENDPOINT,
    APPWRITE_PROJECT_ID: env.APPWRITE_PROJECT_ID,
    APPWRITE_API_KEY: site.CORTEX_WEB_API_KEY,
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

export function variableOperations(desired: Record<string, string>, current: SiteVariable[]): VariableOperation[] {
  const secretsChanged = current.find((variable) => variable.key === secretHashKey)?.value !== desired[secretHashKey];
  const operations: VariableOperation[] = [];
  for (const [key, value] of Object.entries(desired)) {
    const found = current.find((variable) => variable.key === key);
    if (found === undefined) operations.push({ kind: "create", key });
    else if (isSecretKey(key) ? secretsChanged || !found.secret : found.value !== value) operations.push({ kind: "update", key, id: found.$id });
  }
  for (const variable of current) {
    if ((managedKeys as readonly string[]).includes(variable.key) && !(variable.key in desired)) operations.push({ kind: "remove", key: variable.key, id: variable.$id });
  }
  return [...operations.filter((operation) => operation.key !== secretHashKey), ...operations.filter((operation) => operation.key === secretHashKey)];
}

export function deploymentHash(bundleHash: string, desired: Record<string, string>): string {
  const hash = createHash("sha256").update(`${bundleHash}\n`);
  for (const key of Object.keys(desired).sort()) hash.update(`${key}=${isSecretKey(key) ? "" : desired[key]}\n`);
  return hash.digest("hex");
}

export function settingsDiffer(current: Partial<SiteSettings>): boolean {
  return (Object.keys(siteSettings) as Array<keyof SiteSettings>).some((key) => current[key] !== siteSettings[key]);
}

export function needsDeployment(input: { deploymentHash: string; storedHash: string | null; activeReady: boolean }): boolean {
  return !input.activeReady || input.storedHash !== input.deploymentHash;
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
