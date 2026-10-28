import { describe, expect, it } from "vitest";
import type { DiffRow } from "./diff-rows";
import { changeStarts, expandFold, foldRows } from "./diff-rows";

function rows(pattern: string): DiffRow[] {
  let oldNumber = 0;
  let newNumber = 0;
  return [...pattern].map((symbol, index) => {
    const kind = symbol === "+" ? "add" : symbol === "-" ? "del" : "same";
    if (kind !== "add") oldNumber += 1;
    if (kind !== "del") newNumber += 1;
    return { kind, oldNumber: kind === "add" ? null : oldNumber, newNumber: kind === "del" ? null : newNumber, text: `line ${index}` };
  });
}

describe("foldRows", () => {
  it("keeps runs of up to seven unchanged lines", () => {
    const items = foldRows(rows("+.......+"));
    expect(items.every((item) => item.type === "row")).toBe(true);
  });

  it("folds a long run between changes leaving three lines of context on each side", () => {
    const items = foldRows(rows(`+${".".repeat(20)}+`));
    expect(items.map((item) => item.type)).toEqual(["row", "row", "row", "row", "fold", "row", "row", "row", "row"]);
    expect(items[4]).toEqual({ type: "fold", from: 4, to: 18, count: 14 });
  });

  it("folds a leading run keeping the last three lines", () => {
    const items = foldRows(rows(`${".".repeat(10)}+`));
    expect(items[0]).toEqual({ type: "fold", from: 0, to: 7, count: 7 });
    expect(items).toHaveLength(5);
  });

  it("folds a trailing run keeping the first three lines", () => {
    const items = foldRows(rows(`-${".".repeat(10)}`));
    expect(items.at(-1)).toEqual({ type: "fold", from: 4, to: 11, count: 7 });
    expect(items).toHaveLength(5);
  });

  it("never folds a document that is entirely added", () => {
    expect(foldRows(rows("+".repeat(30))).every((item) => item.type === "row")).toBe(true);
  });
});

describe("expandFold", () => {
  it("restores the folded rows in order", () => {
    const source = rows(`+${".".repeat(20)}+`);
    const expanded = expandFold(foldRows(source), source, 4);
    expect(expanded.every((item) => item.type === "row")).toBe(true);
    expect(expanded.map((item) => (item.type === "row" ? item.index : -1))).toEqual(source.map((_, index) => index));
  });
});

describe("changeStarts", () => {
  it("returns the first row of each run of changes", () => {
    expect(changeStarts(rows(".++.-.+"))).toEqual([1, 4, 6]);
  });
});
