import { describe, expect, it } from "vitest";
import type { DocumentStatus, FileKind } from "@cortex/core";
import type { Caller } from "@cortex/server-kit";
import type { WriteAction, WriteContext } from "./lifecycle";
import { authorSlugOf, decideTransition, decideWrite, statusTransitions } from "./lifecycle";

const caller: Caller = { userId: "me", name: "Me", email: "Ada.Lovelace+x@example.com", labels: [], channel: "web" };
const ctx = (overrides: Partial<WriteContext> = {}): WriteContext => ({
  caller,
  isAdmin: false,
  sectorRole: "maintainer",
  sectorKind: "project",
  authorSlug: authorSlugOf(caller),
  ...overrides,
});
const reason = (decision: ReturnType<typeof decideWrite>) => (decision.allowed ? "allowed" : decision.error.code === "forbidden" ? decision.error.reason : decision.error.code);

describe("authorSlugOf", () => {
  it("slugifies the local part of the e-mail", () => {
    expect(authorSlugOf(caller)).toBe("ada-lovelace-x");
  });
});

describe("decideWrite", () => {
  it("refuses read tokens before anything else", () => {
    expect(reason(decideWrite("note", "a.md", "create", ctx({ caller: { ...caller, channel: "token", tokenScope: "read" } }), null))).toBe("token_scope");
  });

  it("routes spine writes by non-admins to proposals", () => {
    expect(reason(decideWrite("standard", "standards/a.md", "update", ctx({ sectorKind: "spine" }), null))).toBe("spine_requires_proposal");
    expect(reason(decideWrite("standard", "standards/a.md", "update", ctx({ sectorKind: "spine", isAdmin: true }), null))).toBe("allowed");
  });

  it("lets any member write only their own memory", () => {
    expect(reason(decideWrite("memory", "memory/ada-lovelace-x/n.md", "create", ctx({ sectorRole: "reader" }), null))).toBe("allowed");
    expect(reason(decideWrite("memory", "memory/someone/n.md", "create", ctx(), null))).toBe("memory_owner");
    expect(reason(decideWrite("memory", "memory/ada-lovelace-x/n.md", "update", ctx(), { authorId: "other", status: null }))).toBe("memory_owner");
    expect(reason(decideWrite("memory", "memory/ada-lovelace-x/n.md", "create", ctx({ sectorRole: null }), null))).toBe("memory_owner");
  });

  it("requires a maintainer or admin for other kinds", () => {
    for (const kind of ["note", "module", "spec", "backlog", "finding"] as FileKind[]) {
      expect(reason(decideWrite(kind, "x.md", "create", ctx({ sectorRole: "reader" }), null))).toBe("role");
      expect(reason(decideWrite(kind, "x.md", "create", ctx(), null))).toBe("allowed");
    }
  });

  const immutableCases: Array<[DocumentStatus, string, boolean, WriteAction, string]> = [
    ["draft", "me", false, "update", "allowed"],
    ["draft", "other", false, "update", "not_author"],
    ["draft", "other", true, "update", "allowed"],
    ["approved", "me", false, "update", "immutable"],
    ["approved", "me", false, "delete", "immutable"],
    ["implemented", "other", true, "update", "allowed"],
  ];
  it.each(immutableCases)("immutable %s by author %s admin %s %s gives %s", (status, authorId, isAdmin, action, expected) => {
    expect(reason(decideWrite("spec", "specs/SPEC-001-a.md", action, ctx({ isAdmin }), { authorId, status }))).toBe(expected);
  });

  it("keeps findings write-once except an admin delete", () => {
    const existing = { authorId: "me", status: "approved" as const };
    expect(reason(decideWrite("finding", "docs/findings/FINDING-001-a.md", "update", ctx(), existing))).toBe("immutable");
    expect(reason(decideWrite("finding", "docs/findings/FINDING-001-a.md", "delete", ctx(), existing))).toBe("immutable");
    expect(reason(decideWrite("finding", "docs/findings/FINDING-001-a.md", "delete", ctx({ isAdmin: true }), existing))).toBe("allowed");
  });

  it("lets maintainers edit living documents", () => {
    expect(reason(decideWrite("module", "AGENTS.md", "update", ctx(), { authorId: "other", status: null }))).toBe("allowed");
  });
});

describe("decideTransition", () => {
  it("accepts every transition from the table", () => {
    for (const [from, targets] of Object.entries(statusTransitions) as Array<[DocumentStatus, readonly DocumentStatus[]]>) {
      for (const to of targets) expect(decideTransition("spec", from, to).allowed).toBe(true);
    }
  });

  it("refuses jumps, superseded targets, findings and terminal states", () => {
    expect(decideTransition("spec", "draft", "implemented").allowed).toBe(false);
    expect(decideTransition("spec", "approved", "superseded").allowed).toBe(false);
    expect(decideTransition("finding", "approved", "deprecated").allowed).toBe(false);
    expect(decideTransition("backlog", "deprecated", "draft").allowed).toBe(false);
    expect(decideTransition("note", null, "approved").allowed).toBe(false);
  });
});
