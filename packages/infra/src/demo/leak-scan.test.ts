import { describe, expect, it } from "vitest";
import { parseDenylist, scanCorpus } from "./leak-scan";

describe("parseDenylist", () => {
  it("drops blank lines and comments", () => {
    expect(parseDenylist("# names\nAcme\n\n  Globex  \n")).toEqual(["Acme", "Globex"]);
  });
});

describe("scanCorpus", () => {
  it("reports denylisted terms case-insensitively without echoing them", () => {
    const findings = scanCorpus(new Map([["spine/a.md", "# Title\nWorked on the ACME shop\n"]]), ["acme"]);
    expect(findings).toEqual([{ file: "spine/a.md", line: 2, reason: "denylisted term" }]);
  });

  it("reports secrets with their rule", () => {
    const findings = scanCorpus(new Map([["cortex/b.md", "token ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789\n"]]), []);
    expect(findings[0]?.reason).toMatch(/^secret /);
  });

  it("is empty for a clean corpus", () => {
    expect(scanCorpus(new Map([["x.md", "# Clean\nNothing here\n"]]), ["acme"])).toEqual([]);
  });
});
