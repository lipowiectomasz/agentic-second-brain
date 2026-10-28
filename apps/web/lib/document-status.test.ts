import { describe, expect, it } from "vitest";
import { documentStatuses } from "@cortex/core/document-status";
import { isSealed, versionLine } from "./document-status";

describe("isSealed", () => {
  it("is false only for drafts", () => {
    expect(documentStatuses.filter((status) => !isSealed(status))).toEqual(["draft"]);
  });
});

describe("versionLine", () => {
  it("is omitted for the first version", () => {
    expect(versionLine(1)).toBeNull();
  });

  it("counts earlier versions with the right plural", () => {
    expect(versionLine(2)).toBe("v2 · 1 earlier version");
    expect(versionLine(4)).toBe("v4 · 3 earlier versions");
  });
});
