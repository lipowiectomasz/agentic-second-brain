import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next-path";

describe("safeNextPath", () => {
  it.each(["//evil.example", "https://x.example", "/\\evil", "\\x", "", null, undefined, "relative"])("rejects %s", (value) => {
    expect(safeNextPath(value)).toBe("/");
  });

  it("accepts an internal path with a query", () => {
    expect(safeNextPath("/sectors/a?x=1")).toBe("/sectors/a?x=1");
  });
});
