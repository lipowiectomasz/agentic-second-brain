import { describe, expect, it } from "vitest";
import { EnvValidationError, loadServerEnv } from "./env";
import { assertTestNamespace, databaseIds } from "./namespace";

const validEnv = {
  APPWRITE_ENDPOINT: "http://localhost:18080/v1",
  APPWRITE_PROJECT_ID: "cortex",
  APPWRITE_API_KEY: "standard_0123456789abcdef0123456789abcdef",
  CORTEX_DATABASE_NAMESPACE: "cortex",
  CORTEX_TEST_DATABASE_NAMESPACE: "cortex_test",
};

describe("loadServerEnv", () => {
  it("parses a valid environment and applies defaults", () => {
    const env = loadServerEnv(validEnv);
    expect(env.CORTEX_MAX_PENDING_PROPOSALS).toBe(20);
    expect(env.APPWRITE_INTERNAL_ENDPOINT).toBeUndefined();
  });

  it("reports every missing or invalid variable by name", () => {
    const attempt = () =>
      loadServerEnv({ ...validEnv, APPWRITE_API_KEY: "", APPWRITE_PROJECT_ID: "Bad Id", APPWRITE_ENDPOINT: undefined });
    expect(attempt).toThrowError(EnvValidationError);
    try {
      attempt();
    } catch (error) {
      expect((error as EnvValidationError).variables).toEqual([
        "APPWRITE_API_KEY",
        "APPWRITE_ENDPOINT",
        "APPWRITE_PROJECT_ID",
      ]);
    }
  });

  it("never includes values in the error message", () => {
    const secret = "short-secret-value";
    expect(() => loadServerEnv({ ...validEnv, APPWRITE_API_KEY: secret })).toThrowError(
      expect.objectContaining({ message: expect.not.stringContaining(secret) }),
    );
  });

  it("requires the test namespace to end with _test", () => {
    expect(() => loadServerEnv({ ...validEnv, CORTEX_TEST_DATABASE_NAMESPACE: "cortex" })).toThrowError(
      EnvValidationError,
    );
  });
});

describe("namespaces", () => {
  it("derives one database id per engine", () => {
    expect(databaseIds("cortex")).toEqual({ vectors: "cortex_vectors", tables: "cortex_tables" });
  });

  it("accepts only test namespaces in assertTestNamespace", () => {
    expect(() => assertTestNamespace("cortex_test")).not.toThrow();
    expect(() => assertTestNamespace("cortex")).toThrow();
  });
});
