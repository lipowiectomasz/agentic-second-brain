import { describe, expect, it } from "vitest";
import { maskSecret, scanForSecrets } from "./secrets";

const samples: Array<[string, string]> = [
  ["aws-access-key", "key AKIAIOSFODNN7EXAMPLE here"],
  ["github-token", `token ghp_${"a1B2".repeat(9)}`],
  ["slack-token", "xoxb-1234567890-abcdefghij"],
  ["private-key", "-----BEGIN OPENSSH PRIVATE KEY-----"],
  ["jwt", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"],
  ["appwrite-key", `standard_${"ab12".repeat(32)}`],
  ["stripe-live-key", `sk_live_${"Ab1".repeat(8)}`],
  ["google-api-key", `AIza${"Sy0_-aB1c".repeat(3)}abcdefgh`],
  ["generic-assignment", 'api_key = "Zx8$kQ2!mP9vL4#tR7wN"'],
];

describe("scanForSecrets", () => {
  it.each(samples)("detects %s", (ruleId, line) => {
    const findings = scanForSecrets(`# Title\n\n${line}\n`);
    expect(findings.map((finding) => finding.ruleId)).toContain(ruleId);
    expect(findings[0]?.line).toBe(3);
  });

  it("ignores placeholders and low-entropy values", () => {
    expect(scanForSecrets("password: <your-password>\napi_key = changeme\ntoken: xxxxxxxxxxxxxxxxxxxx\nsecret = aaaaaaaaaaaaaaaaaaaa")).toEqual([]);
  });

  it("ignores ordinary prose", () => {
    expect(scanForSecrets("Use the token from the vault. The secret sauce is testing.")).toEqual([]);
  });

  it("masks the value in the preview", () => {
    const [finding] = scanForSecrets("AKIAIOSFODNN7EXAMPLE");
    expect(finding?.preview).toBe("AKIA************MPLE");
    expect(finding?.preview).not.toContain("IOSFODNN7");
  });

  it("caps findings at 20", () => {
    expect(scanForSecrets(Array.from({ length: 30 }, () => "AKIAIOSFODNN7EXAMPLE").join("\n"))).toHaveLength(20);
  });

  it("masks short values completely", () => {
    expect(maskSecret("abcd")).toBe("****");
  });
});
