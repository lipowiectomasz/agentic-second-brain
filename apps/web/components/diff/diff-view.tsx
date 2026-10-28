"use client";

import { useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import type { DiffItem, DiffRow } from "@/lib/diff-rows";
import { changeStarts, expandFold, foldRows } from "@/lib/diff-rows";

const markers = { add: "+", del: "−", same: "" } as const;
const spoken = { add: "Added: ", del: "Removed: ", same: "" } as const;

function hunkOf(rows: DiffRow[], starts: number[], index: number): number | null {
  if (rows[index]?.kind === "same") return null;
  let hunk: number | null = null;
  starts.forEach((start, position) => {
    if (start <= index) hunk = position;
  });
  return hunk;
}

export function DiffView({ path, rows, context = 3 }: { path: string; rows: DiffRow[]; context?: number }) {
  const [expanded, setExpanded] = useState<number[]>([]);
  const [current, setCurrent] = useState(0);
  const rowRefs = useRef(new Map<number, HTMLDivElement>());
  const starts = useMemo(() => changeStarts(rows), [rows]);
  const items = useMemo(() => expanded.reduce<DiffItem[]>((acc, from) => expandFold(acc, rows, from), foldRows(rows, context)), [rows, context, expanded]);
  const added = rows.filter((row) => row.kind === "add").length;
  const removed = rows.filter((row) => row.kind === "del").length;

  function move(step: number) {
    if (starts.length === 0) return;
    const next = Math.min(Math.max(current + step, 0), starts.length - 1);
    setCurrent(next);
    rowRefs.current.get(starts[next] ?? 0)?.scrollIntoView({ block: "center" });
  }

  return (
    <div
      className="diff"
      tabIndex={0}
      aria-label={`Changes to ${path}`}
      onKeyDown={(event) => {
        if (event.key === "j" || event.key === "J") {
          event.preventDefault();
          move(1);
        } else if (event.key === "k" || event.key === "K") {
          event.preventDefault();
          move(-1);
        }
      }}
    >
      <div className="diff-head">
        <span className="mono text-foreground">{path}</span>
        <span className="mono" style={{ color: "var(--success)" }}>
          +{added}
        </span>
        <span className="mono" style={{ color: "var(--danger)" }}>
          −{removed}
        </span>
        <span className="flex-1" />
        {starts.length > 0 && (
          <span className="flex items-center gap-2">
            <span aria-live="polite">
              Change {current + 1} of {starts.length}
            </span>
            <kbd className="kbd">K</kbd>
            <kbd className="kbd">J</kbd>
          </span>
        )}
      </div>
      {items.map((item) => {
        if (item.type === "fold") {
          return (
            <button key={`fold-${item.from}`} type="button" className="diff-fold" onClick={() => setExpanded((list) => [...list, item.from])}>
              <Icon name="unfold" size={14} />
              Show {item.count} unchanged lines
            </button>
          );
        }
        const { row, index } = item;
        const hunk = hunkOf(rows, starts, index);
        return (
          <div
            key={index}
            ref={(element) => {
              if (element === null) rowRefs.current.delete(index);
              else rowRefs.current.set(index, element);
            }}
            className={`diff-row ${row.kind === "add" ? "diff-add" : row.kind === "del" ? "diff-del" : ""} ${hunk !== null && hunk === current ? "diff-hunk-on" : ""}`}
          >
            <span className="ln">{row.oldNumber ?? ""}</span>
            <span className="ln">{row.newNumber ?? ""}</span>
            <span className="mk" aria-hidden>
              {markers[row.kind]}
            </span>
            <span className="code">
              {row.kind !== "same" && <span className="sr-only">{spoken[row.kind]}</span>}
              {row.text}
            </span>
          </div>
        );
      })}
      <p className="xsmall muted border-t border-border px-3 py-2">
        Tab into the diff, then <kbd className="kbd">J</kbd> next change · <kbd className="kbd">K</kbd> previous. Added lines are marked +, removed lines −.
      </p>
    </div>
  );
}
