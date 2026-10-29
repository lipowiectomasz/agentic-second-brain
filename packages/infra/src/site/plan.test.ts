import { describe, expect, it } from "vitest";
import type { ServerEnv } from "@cortex/config";
import { logTail, needsDeployment, ruleAction, secretHashKey, settingsDiffer, siteId, siteSettings, siteVariables, variableChanges } from "./plan";

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
  NEXT_PUBLIC_APPWRITE_ENDPOINT: "http://localhost:27080/v1",
  NEXT_PUBLIC_APPWRITE_PROJECT_ID: "cortex",
};

function asRemote(variables: Record<string, string>) {
  return Object.entries(variables).map(([key, value]) => ({ $id: key.toLowerCase(), key, value: key === "APPWRITE_API_KEY" ? "" : value, secret: key === "APPWRITE_API_KEY" }));
}

describe("siteVariables", () => {
  it("points the runtime at the internal API and the site URL", () => {
    const variables = siteVariables(env, site);
    expect(variables.APPWRITE_INTERNAL_ENDPOINT).toBe("http://appwrite-api/v1");
    expect(variables.APP_URL).toBe("http://cortex.sites.localhost:27080");
    expect(variables.GITHUB_OAUTH_CLIENT_ID).toBeUndefined();
    expect(variables[secretHashKey]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes the secret hash when the key changes", () => {
    expect(siteVariables(env, site)[secretHashKey]).not.toBe(siteVariables({ ...env, APPWRITE_API_KEY: "x".repeat(40) }, site)[secretHashKey]);
  });
});

describe("variableChanges", () => {
  it("creates every missing variable", () => {
    const desired = siteVariables(env, site);
    expect(variableChanges(desired, []).create).toEqual(Object.keys(desired));
  });

  it("reports nothing when the remote matches, comparing secrets by hash", () => {
    const desired = siteVariables(env, site);
    expect(variableChanges(desired, asRemote(desired))).toEqual({ create: [], update: [] });
  });

  it("updates differing values and the secret when its hash moved, leaving extras alone", () => {
    const desired = siteVariables(env, site);
    const remote = [...asRemote(siteVariables({ ...env, APPWRITE_API_KEY: "x".repeat(40) }, site)), { $id: "extra", key: "EXTRA", value: "1", secret: false }].map((variable) => (variable.key === "APPWRITE_ENDPOINT" ? { ...variable, value: "http://elsewhere/v1" } : variable));
    expect(variableChanges(desired, remote).update.map((change) => change.key).sort()).toEqual(["APPWRITE_API_KEY", "APPWRITE_ENDPOINT", secretHashKey].sort());
  });
});

describe("settingsDiffer", () => {
  it("is false for identical settings and true for any difference", () => {
    expect(settingsDiffer({ ...siteSettings })).toBe(false);
    expect(settingsDiffer({ ...siteSettings, buildCommand: "npm run build" })).toBe(true);
  });
});

describe("needsDeployment", () => {
  const base = { bundleHash: "a", storedHash: "a", variablesChanged: false, activeReady: true };
  it("skips only when nothing changed", () => {
    expect(needsDeployment(base)).toBe(false);
    expect(needsDeployment({ ...base, storedHash: null })).toBe(true);
    expect(needsDeployment({ ...base, storedHash: "b" })).toBe(true);
    expect(needsDeployment({ ...base, variablesChanged: true })).toBe(true);
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
