import { describe, expect, it } from "vitest";
import type { Caller } from "@cortex/server-kit";
import { canDecideRequest, canWriteSector, decideRoleChange, deriveSlug, roleFromTeamRoles } from "./rules";

const member: Caller = { userId: "u", name: "M", email: "m@example.com", labels: [], channel: "web" };
const admin: Caller = { ...member, labels: ["admin"] };

describe("decideRoleChange", () => {
  const base = { targetCurrentRole: null, requestedRole: "reader" as const, sectorKind: "project" as const };

  it("refuses any change on the spine, even for admins", () => {
    expect(decideRoleChange({ ...base, sectorKind: "spine", actor: { isOrgAdmin: true, actorRole: null } })).toEqual({ allowed: false, reason: "spine_read_only" });
  });

  it("lets admins set any role", () => {
    expect(decideRoleChange({ ...base, requestedRole: "maintainer", actor: { isOrgAdmin: true, actorRole: null } })).toEqual({ allowed: true });
  });

  it("refuses non-maintainers", () => {
    expect(decideRoleChange({ ...base, actor: { isOrgAdmin: false, actorRole: "reader" } })).toEqual({ allowed: false, reason: "not_maintainer" });
  });

  it("lets maintainers grant and remove readers", () => {
    expect(decideRoleChange({ ...base, actor: { isOrgAdmin: false, actorRole: "maintainer" } })).toEqual({ allowed: true });
    expect(decideRoleChange({ ...base, targetCurrentRole: "reader", requestedRole: null, actor: { isOrgAdmin: false, actorRole: "maintainer" } })).toEqual({ allowed: true });
  });

  it("keeps maintainer changes for admins", () => {
    const actor = { isOrgAdmin: false, actorRole: "maintainer" as const };
    expect(decideRoleChange({ ...base, requestedRole: "maintainer", actor })).toEqual({ allowed: false, reason: "maintainer_requires_admin" });
    expect(decideRoleChange({ ...base, targetCurrentRole: "maintainer", requestedRole: null, actor })).toEqual({ allowed: false, reason: "maintainer_requires_admin" });
  });
});

describe("canWriteSector", () => {
  it("lets only admins write the spine", () => {
    expect(canWriteSector(admin, "spine", null)).toBe(true);
    expect(canWriteSector(member, "spine", "maintainer")).toBe(false);
  });

  it("lets maintainers and admins write a project sector", () => {
    expect(canWriteSector(member, "project", "maintainer")).toBe(true);
    expect(canWriteSector(member, "project", "reader")).toBe(false);
    expect(canWriteSector(admin, "project", null)).toBe(true);
  });

  it("refuses read-only tokens", () => {
    expect(canWriteSector({ ...admin, channel: "token", tokenScope: "read" }, "project", "maintainer")).toBe(false);
    expect(canWriteSector({ ...member, channel: "token", tokenScope: "write" }, "project", "maintainer")).toBe(true);
  });
});

describe("canDecideRequest", () => {
  it("lets admins decide anything and maintainers only reader requests", () => {
    expect(canDecideRequest(admin, null, "maintainer")).toBe(true);
    expect(canDecideRequest(member, "maintainer", "reader")).toBe(true);
    expect(canDecideRequest(member, "maintainer", "maintainer")).toBe(false);
    expect(canDecideRequest(member, "reader", "reader")).toBe(false);
  });
});

describe("deriveSlug", () => {
  it.each([
    ["Atlas Storefront", "atlas-storefront"],
    ["  Łódź / Kraków  ", "lodz-krakow"],
    ["Ünïcode -- name!", "unicode-name"],
  ])("derives %s", (name, slug) => {
    expect(deriveSlug(name)).toBe(slug);
  });
});

describe("roleFromTeamRoles", () => {
  it("prefers maintainer", () => {
    expect(roleFromTeamRoles(["reader", "maintainer"])).toBe("maintainer");
    expect(roleFromTeamRoles(["reader"])).toBe("reader");
  });
});
