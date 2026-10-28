import { diffLines } from "diff";
import { normalizeLineEndings } from "@cortex/core/body-hash";
import type { DiffRow } from "./types";

export function buildDiffModel(before: string, after: string): DiffRow[] {
  const rows: DiffRow[] = [];
  let oldNumber = 0;
  let newNumber = 0;
  for (const part of diffLines(normalizeLineEndings(before), normalizeLineEndings(after))) {
    const lines = part.value.replace(/\n$/, "").split("\n");
    for (const text of lines) {
      if (part.added) {
        newNumber += 1;
        rows.push({ kind: "add", oldNumber: null, newNumber, text });
      } else if (part.removed) {
        oldNumber += 1;
        rows.push({ kind: "del", oldNumber, newNumber: null, text });
      } else {
        oldNumber += 1;
        newNumber += 1;
        rows.push({ kind: "same", oldNumber, newNumber, text });
      }
    }
  }
  return before === "" && after === "" ? [] : rows;
}
