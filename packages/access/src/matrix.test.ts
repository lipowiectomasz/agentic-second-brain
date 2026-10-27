import { describe, expect, it } from "vitest";
import { buildMatrix } from "./matrix";
import type { SectorRow } from "./types";

const sectors: SectorRow[] = [
  { id: "spine", slug: "spine", name: "Spine", kind: "spine", teamId: "sector-spine", color: "#000000", description: null },
  { id: "atlas", slug: "atlas", name: "Atlas", kind: "project", teamId: "sector-atlas", color: "#1d6f70", description: null },
  { id: "harbor", slug: "harbor", name: "Harbor", kind: "project", teamId: "sector-harbor", color: "#4a4ea0", description: null },
];
const users = [
  { $id: "b", name: "Bea", email: "bea@example.com", labels: ["admin"] },
  { $id: "a", name: "Ann", email: "ann@example.com", labels: [] },
  { $id: "t", name: "test-ghost", email: "ghost@example.com", labels: [] },
];
const memberships = new Map([
  ["sector-atlas", [{ userId: "a", roles: ["maintainer"] }, { userId: "b", roles: ["reader"] }]],
  ["sector-harbor", [{ userId: "a", roles: ["reader"] }]],
]);

describe("buildMatrix", () => {
  it("lists project sectors only and one row per member sorted by name", () => {
    const matrix = buildMatrix(users, sectors, memberships, false);
    expect(matrix.sectors.map((sector) => sector.id)).toEqual(["atlas", "harbor"]);
    expect(matrix.rows.map((row) => row.name)).toEqual(["Ann", "Bea"]);
  });

  it("maps memberships to roles and admins to the org admin flag", () => {
    const [ann, bea] = buildMatrix(users, sectors, memberships, false).rows;
    expect(ann).toMatchObject({ isOrgAdmin: false, roles: { atlas: "maintainer", harbor: "reader" } });
    expect(bea).toMatchObject({ isOrgAdmin: true, roles: { atlas: "reader", harbor: null } });
  });

  it("includes test identities only when asked", () => {
    expect(buildMatrix(users, sectors, memberships, true).rows).toHaveLength(3);
  });
});
