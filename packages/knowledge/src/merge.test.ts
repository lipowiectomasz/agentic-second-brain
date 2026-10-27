import { describe, expect, it } from "vitest";
import { mergeThreeWay } from "./merge";

const base = "# A\nline 1\nline 2\nline 3\nline 4\nline 5\n";

describe("mergeThreeWay", () => {
  it("returns current when both sides are equal", () => {
    expect(mergeThreeWay(base, "x", "x")).toEqual({ content: "x", overlapped: false });
  });

  it("fast-forwards when current equals base", () => {
    expect(mergeThreeWay(base, base, "new")).toEqual({ content: "new", overlapped: false });
  });

  it("keeps current when the caller is behind", () => {
    expect(mergeThreeWay(base, "newer", base)).toEqual({ content: "newer", overlapped: false });
  });

  it("combines disjoint edits", () => {
    const current = base.replace("line 1", "line 1 by current");
    const incoming = base.replace("line 5", "line 5 by incoming");
    const result = mergeThreeWay(base, current, incoming);
    expect(result.overlapped).toBe(false);
    expect(result.content).toContain("line 1 by current");
    expect(result.content).toContain("line 5 by incoming");
  });

  it("takes incoming on the same line and reports the overlap", () => {
    const result = mergeThreeWay(base, base.replace("line 3", "current 3"), base.replace("line 3", "incoming 3"));
    expect(result).toEqual({ content: base.replace("line 3", "incoming 3"), overlapped: true });
  });

  it("merges insertions at both ends", () => {
    const result = mergeThreeWay(base, `top\n${base}`, `${base}bottom\n`);
    expect(result.content.startsWith("top\n# A")).toBe(true);
    expect(result.content.endsWith("bottom\n")).toBe(true);
  });

  it("normalises CRLF before merging", () => {
    expect(mergeThreeWay("a\nb\n", "a\r\nb\r\n", "a\nb\nc\n").content).toBe("a\nb\nc\n");
  });
});
