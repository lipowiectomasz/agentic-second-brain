import { describe, expect, it } from "vitest";
import { sectorReadPermissions, sectorWritePermissions } from "./permissions";
import { sectorTeamId } from "./team-id";

const spine = { kind: "spine" as const, teamId: "sector-spine" };
const project = { kind: "project" as const, teamId: "sector-atlas" };

describe("sector permissions", () => {
  it("lets every signed-in member read the spine", () => {
    expect(sectorReadPermissions(spine)).toEqual(['read("users")']);
  });

  it("limits project reads to the sector team", () => {
    expect(sectorReadPermissions(project)).toEqual(['read("team:sector-atlas")']);
  });

  it("lets only admins write the spine", () => {
    expect(sectorWritePermissions(spine)).toEqual(['update("label:admin")', 'delete("label:admin")']);
  });

  it("lets maintainers and admins write a project sector", () => {
    expect(sectorWritePermissions(project)).toEqual([
      'update("team:sector-atlas/maintainer")',
      'delete("team:sector-atlas/maintainer")',
      'update("label:admin")',
      'delete("label:admin")',
    ]);
  });
});

describe("sectorTeamId", () => {
  it("prefixes the slug", () => {
    expect(sectorTeamId("atlas-storefront")).toBe("sector-atlas-storefront");
  });

  it("rejects unsafe slugs", () => {
    expect(() => sectorTeamId("Atlas Storefront")).toThrow();
    expect(() => sectorTeamId("../x")).toThrow();
  });
});
