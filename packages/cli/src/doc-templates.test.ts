import { describe, expect, it } from "vitest";
import { reservedPath, templateFor } from "./doc-templates";

describe("document templates", () => {
  it("builds the conventional paths", () => {
    expect(reservedPath("spec", "SPEC-015", "carrier-retry")).toBe("specs/development/SPEC-015-carrier-retry.md");
    expect(reservedPath("backlog", "TASK-015", "retry")).toBe("docs/backlog/TASK-015-retry.md");
    expect(reservedPath("finding", "FINDING-003", "limits")).toBe("docs/findings/FINDING-003-limits.md");
  });

  it("writes the reserved ID and the relation into the frontmatter", () => {
    expect(templateFor("finding", "FINDING-003", "Limits", "SPEC-003")).toBe("---\nid: FINDING-003\nrelates_to: SPEC-003\n---\n# Limits\n\n");
    expect(templateFor("spec", "SPEC-015", "Carrier retry", null)).toBe("---\nid: SPEC-015\nstatus: draft\n---\n# Carrier retry\n\n");
  });
});
