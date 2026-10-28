import { describe, expect, it } from "vitest";
import { auditActions } from "@cortex/core";
import { actionGroups, actionLabels, relativeTime } from "./audit-labels";

describe("audit labels", () => {
  it("labels and groups every action exactly once", () => {
    expect(Object.keys(actionLabels).sort()).toEqual([...auditActions].sort());
    expect(actionGroups.flatMap((group) => group.actions).sort()).toEqual([...auditActions].sort());
  });

  it("formats relative times", () => {
    const now = new Date("2026-10-29T12:00:00Z");
    expect(relativeTime("2026-10-29T11:59:30Z", now)).toBe("just now");
    expect(relativeTime("2026-10-29T11:56:00Z", now)).toBe("4 min ago");
    expect(relativeTime("2026-10-29T09:00:00Z", now)).toBe("3 h ago");
    expect(relativeTime("2026-10-28T10:00:00Z", now)).toBe("yesterday");
  });
});
