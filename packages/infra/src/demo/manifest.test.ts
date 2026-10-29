import { describe, expect, it } from "vitest";
import type { DemoManifest } from "./manifest";
import { checkManifest, demoManifestSchema, ingestOrder, statusSteps } from "./manifest";

const accounts: DemoManifest["accounts"] = [
  { key: "admin", name: "demo-admin", email: "demo-admin@example.com", admin: true, memberships: [] },
  { key: "maintainer", name: "demo-maintainer", email: "demo-maintainer@example.com", admin: false, memberships: [{ sector: "atlas", role: "maintainer" }] },
  { key: "reader", name: "demo-reader", email: "demo-reader@example.com", admin: false, memberships: [] },
];
const base: DemoManifest = {
  sectors: [{ slug: "atlas", name: "Atlas", color: "sector-1", description: "" }],
  accounts,
  files: [
    { sector: "atlas", file: "a.md", path: "specs/development/SPEC-001-a.md", status: "approved" },
    { sector: "atlas", file: "b.md", path: "specs/development/SPEC-002-b.md", supersedes: "SPEC-001" },
    { sector: "atlas", file: "f.md", path: "docs/findings/FINDING-001-f.md", relatesTo: "SPEC-002" },
    { sector: "spine", file: "s.md", path: "standards/core/s.md" },
  ],
};

describe("demo manifest", () => {
  it("accepts a consistent manifest", () => {
    expect(checkManifest(base)).toEqual([]);
  });

  it("reports unknown sectors, unsafe paths, duplicates and dangling links", () => {
    const broken: DemoManifest = {
      ...base,
      files: [...base.files, { sector: "orion", file: "x.md", path: "notes/x.md" }, { sector: "atlas", file: "y.md", path: "../y.md" }, { sector: "atlas", file: "z.md", path: "specs/development/SPEC-001-a.md" }, { sector: "atlas", file: "g.md", path: "docs/findings/FINDING-002-g.md", relatesTo: "SPEC-009" }],
    };
    expect(checkManifest(broken)).toEqual([
      "x.md: unknown sector orion",
      "y.md: path ../y.md is traversal",
      "atlas/specs/development/SPEC-001-a.md: declared twice",
      "g.md: relates to unknown SPEC-009",
    ]);
  });

  it("refuses e-mail addresses outside example.com", () => {
    const first = accounts[0];
    if (first === undefined) throw new Error("missing account");
    expect(demoManifestSchema.safeParse({ ...base, accounts: [{ ...first, email: "admin@company.com" }, ...accounts.slice(1)] }).success).toBe(false);
  });

  it("walks statuses forward only", () => {
    expect(statusSteps("implemented", "draft")).toEqual(["approved", "in_progress", "implemented"]);
    expect(statusSteps("approved", "implemented")).toEqual([]);
    expect(statusSteps(undefined, "draft")).toEqual([]);
  });

  it("ingests plain files first, then superseding ones, then findings", () => {
    expect(ingestOrder(base.files).map((file) => file.file)).toEqual(["a.md", "s.md", "b.md", "f.md"]);
  });
});
