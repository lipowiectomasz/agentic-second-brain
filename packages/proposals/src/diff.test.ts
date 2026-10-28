import { describe, expect, it } from "vitest";
import { buildDiffModel } from "./diff";

describe("buildDiffModel", () => {
  it("marks every line of a new document as added", () => {
    expect(buildDiffModel("", "# A\nB\n").map((row) => [row.kind, row.newNumber, row.text])).toEqual([
      ["add", 1, "# A"],
      ["add", 2, "B"],
    ]);
  });

  it("keeps identical text unchanged and numbers both sides", () => {
    expect(buildDiffModel("a\nb\n", "a\nb\n").every((row) => row.kind === "same")).toBe(true);
  });

  it("shows a replaced line as removed then added and ignores CRLF", () => {
    const rows = buildDiffModel("a\r\nold\r\nc\r\n", "a\nnew\nc\n");
    expect(rows.map((row) => [row.kind, row.oldNumber, row.newNumber, row.text])).toEqual([
      ["same", 1, 1, "a"],
      ["del", 2, null, "old"],
      ["add", null, 2, "new"],
      ["same", 3, 3, "c"],
    ]);
  });

  it("marks a pure deletion as removed", () => {
    expect(buildDiffModel("a\nb\n", "a\n").map((row) => row.kind)).toEqual(["same", "del"]);
  });
});
