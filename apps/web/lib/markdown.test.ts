import { describe, expect, it } from "vitest";
import { withoutLeadingTitle } from "./markdown";

describe("withoutLeadingTitle", () => {
  it("drops the first heading when it repeats the title", () => {
    expect(withoutLeadingTitle("# Rollback\n\nRedeploy.", "Rollback")).toBe("Redeploy.");
  });

  it("keeps a first heading that differs from the title", () => {
    expect(withoutLeadingTitle("# Intro\n\nText.", "Rollback")).toBe("# Intro\n\nText.");
  });

  it("keeps a body that starts with a lower level heading", () => {
    expect(withoutLeadingTitle("## Rollback\nText.", "Rollback")).toBe("## Rollback\nText.");
  });
});
