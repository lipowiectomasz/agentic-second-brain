import { describe, expect, it } from "vitest";
import type { ServerEnv } from "@cortex/config";
import { deploymentHash, logTail, needsDeployment, ruleAction, secretHashKey, settingsDiffer, siteId, siteSettings, siteVariables, variableOperations } from "./plan";

const env: ServerEnv = {
  APPWRITE_ENDPOINT: "http://localhost:27080/v1",
  APPWRITE_PROJECT_ID: "cortex",
  APPWRITE_API_KEY: "k".repeat(40),
  CORTEX_DATABASE_NAMESPACE: "cortex",
  CORTEX_TEST_DATABASE_NAMESPACE: "cortex_test",
  CORTEX_MAX_PENDING_PROPOSALS: 20,
  APP_URL: "http://localhost:27020",
  CORTEX_EMBEDDING_PREFIX_MODE: "none",
};

const site = {
  CORTEX_SITE_DOMAIN: "cortex.sites.localhost",
  CORTEX_SITE_URL: "http://cortex.sites.localhost:27080",
  CORTEX_FUNCTION_API_ENDPOINT: "http://appwrite-api/v1",
  CORTEX_WEB_API_KEY: "w".repeat(40),
  NEXT_PUBLIC_APPWRITE_ENDPOINT: "http://localhost:27080/v1",
  NEXT_PUBLIC_APPWRITE_PROJECT_ID: "cortex",
};

function asRemote(variables: Record<string, string>) {
  return Object.entries(variables).map(([key, value]) => ({ $id: key.toLowerCase(), key, value: key === "APPWRITE_API_KEY" ? "" : value, secret: key === "APPWRITE_API_KEY" }));
}

describe("siteVariables", () => {
  it("points the runtime at the internal API, the site URL and the web key", () => {
    const variables = siteVariables(env, site);
    expect(variables.APPWRITE_INTERNAL_ENDPOINT).toBe("http://appwrite-api/v1");
    expect(variables.APP_URL).toBe("http://cortex.sites.localhost:27080");
    expect(variables.APPWRITE_API_KEY).toBe("w".repeat(40));
    expect(variables.GITHUB_OAUTH_CLIENT_ID).toBeUndefined();
    expect(variables[secretHashKey]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes the secret hash when the key changes", () => {
    expect(siteVariables(env, site)[secretHashKey]).not.toBe(siteVariables(env, { ...site, CORTEX_WEB_API_KEY: "x".repeat(40) })[secretHashKey]);
  });
});

describe("variableOperations", () => {
  it("creates every missing variable with the secret hash last", () => {
    const desired = siteVariables(env, site);
    const operations = variableOperations(desired, []);
    expect(operations.map((operation) => operation.key).sort()).toEqual(Object.keys(desired).sort());
    expect(operations.at(-1)?.key).toBe(secretHashKey);
  });

  it("reports nothing when the remote matches, comparing secrets by hash", () => {
    const desired = siteVariables(env, site);
    expect(variableOperations(desired, asRemote(desired))).toEqual([]);
  });

  it("updates differing values and the secret when its hash moved, leaving unmanaged extras alone", () => {
    const desired = siteVariables(env, site);
    const remote = [...asRemote(siteVariables(env, { ...site, CORTEX_WEB_API_KEY: "x".repeat(40) })), { $id: "extra", key: "EXTRA", value: "1", secret: false }].map((variable) => (variable.key === "APPWRITE_ENDPOINT" ? { ...variable, value: "http://elsewhere/v1" } : variable));
    const operations = variableOperations(desired, remote);
    expect(operations.map((operation) => `${operation.kind}:${operation.key}`)).toEqual(["update:APPWRITE_ENDPOINT", "update:APPWRITE_API_KEY", `update:${secretHashKey}`]);
  });

  it("removes managed variables that are no longer wanted", () => {
    const withGithub = siteVariables({ ...env, GITHUB_OAUTH_CLIENT_ID: "id", GITHUB_OAUTH_CLIENT_SECRET: "secret" }, site);
    const operations = variableOperations(siteVariables(env, site), asRemote(withGithub));
    expect(operations.map((operation) => `${operation.kind}:${operation.key}`)).toEqual(["update:APPWRITE_API_KEY", "remove:GITHUB_OAUTH_CLIENT_ID", "remove:GITHUB_OAUTH_CLIENT_SECRET", `update:${secretHashKey}`]);
  });
});

describe("deploymentHash", () => {
  it("follows the code and every variable, secrets through their hash only", () => {
    const desired = siteVariables(env, site);
    const base = deploymentHash("a", desired);
    expect(deploymentHash("a", { ...desired })).toBe(base);
    expect(deploymentHash("b", desired)).not.toBe(base);
    expect(deploymentHash("a", { ...desired, APP_URL: "http://other" })).not.toBe(base);
    expect(deploymentHash("a", siteVariables(env, { ...site, CORTEX_WEB_API_KEY: "x".repeat(40) }))).not.toBe(base);
  });
});

describe("settingsDiffer", () => {
  it("is false for identical settings and true for any difference", () => {
    expect(settingsDiffer({ ...siteSettings })).toBe(false);
    expect(settingsDiffer({ ...siteSettings, buildCommand: "npm run build" })).toBe(true);
  });
});

describe("needsDeployment", () => {
  const base = { deploymentHash: "a", storedHash: "a", activeReady: true };
  it("skips only when the deployed hash matches and the active deployment is ready", () => {
    expect(needsDeployment(base)).toBe(false);
    expect(needsDeployment({ ...base, storedHash: null })).toBe(true);
    expect(needsDeployment({ ...base, storedHash: "b" })).toBe(true);
    expect(needsDeployment({ ...base, activeReady: false })).toBe(true);
  });
});

describe("ruleAction", () => {
  it("creates, accepts its own rule and refuses a foreign one", () => {
    expect(ruleAction("cortex.sites.localhost", [])).toBe("create");
    expect(ruleAction("cortex.sites.localhost", [{ domain: "cortex.sites.localhost", deploymentResourceType: "site", deploymentResourceId: siteId }])).toBe("exists");
    expect(ruleAction("cortex.sites.localhost", [{ domain: "cortex.sites.localhost", deploymentResourceType: "function", deploymentResourceId: "cli-gateway" }])).toEqual({ conflict: "function:cli-gateway" });
  });
});

describe("logTail", () => {
  it("keeps the last lines", () => {
    expect(logTail("a\nb\nc\n", 2)).toBe("b\nc");
    expect(logTail("a", 5)).toBe("a");
  });
});
