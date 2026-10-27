import { describe, expect, it } from "vitest";
import { upsertEnvFile } from "./env-file";

describe("upsertEnvFile", () => {
  it("replaces existing keys in place and keeps other lines", () => {
    const content = "A=1\n# note\nB=2\n";
    expect(upsertEnvFile(content, { B: "3" })).toBe("A=1\n# note\nB=3\n");
  });

  it("appends missing keys", () => {
    expect(upsertEnvFile("A=1\n", { C: "x" })).toBe("A=1\nC=x\n");
  });

  it("adds a newline to a file without one before appending", () => {
    expect(upsertEnvFile("A=1", { C: "x" })).toBe("A=1\nC=x\n");
  });

  it("does not treat a key prefix as a match", () => {
    expect(upsertEnvFile("APPWRITE_API_KEY_OLD=1\n", { APPWRITE_API_KEY: "2" })).toBe(
      "APPWRITE_API_KEY_OLD=1\nAPPWRITE_API_KEY=2\n",
    );
  });

  it("writes into an empty file", () => {
    expect(upsertEnvFile("", { A: "1" })).toBe("A=1\n");
  });

  it("rejects invalid key names", () => {
    expect(() => upsertEnvFile("", { "bad key": "1" })).toThrow();
  });
});
