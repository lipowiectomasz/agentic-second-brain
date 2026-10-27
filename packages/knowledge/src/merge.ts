import { diff3Merge } from "node-diff3";
import { normalizeLineEndings } from "@cortex/core";

export interface MergeOutcome {
  content: string;
  overlapped: boolean;
}

export function mergeThreeWay(base: string, current: string, incoming: string): MergeOutcome {
  const o = normalizeLineEndings(base);
  const b = normalizeLineEndings(current);
  const a = normalizeLineEndings(incoming);
  if (a === b) return { content: b, overlapped: false };
  if (b === o) return { content: a, overlapped: false };
  if (a === o) return { content: b, overlapped: false };
  const regions = diff3Merge<string>(a.split("\n"), o.split("\n"), b.split("\n"), { excludeFalseConflicts: true });
  const lines: string[] = [];
  let overlapped = false;
  for (const region of regions) {
    if (region.ok !== undefined) lines.push(...region.ok);
    if (region.conflict !== undefined) {
      lines.push(...region.conflict.a);
      overlapped = true;
    }
  }
  return { content: lines.join("\n"), overlapped };
}
