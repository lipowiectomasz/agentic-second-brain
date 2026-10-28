export type DiffRowKind = "add" | "del" | "same";

export interface DiffRow {
  kind: DiffRowKind;
  oldNumber: number | null;
  newNumber: number | null;
  text: string;
}

export type DiffItem = { type: "row"; row: DiffRow; index: number } | { type: "fold"; from: number; to: number; count: number };

export function foldRows(rows: DiffRow[], context = 3): DiffItem[] {
  const items: DiffItem[] = [];
  let index = 0;
  while (index < rows.length) {
    if (rows[index]?.kind !== "same") {
      items.push({ type: "row", row: rows[index] as DiffRow, index });
      index += 1;
      continue;
    }
    let end = index;
    while (end < rows.length && rows[end]?.kind === "same") end += 1;
    const keepBefore = index === 0 ? 0 : context;
    const keepAfter = end === rows.length ? 0 : context;
    const from = index + keepBefore;
    const to = end - keepAfter;
    const foldable = to - from > 0 && end - index > keepBefore + keepAfter + 1;
    for (let position = index; position < end; position += 1) {
      if (foldable && position === from) items.push({ type: "fold", from, to, count: to - from });
      if (foldable && position >= from && position < to) continue;
      items.push({ type: "row", row: rows[position] as DiffRow, index: position });
    }
    index = end;
  }
  return items;
}

export function expandFold(items: DiffItem[], rows: DiffRow[], from: number): DiffItem[] {
  return items.flatMap((item) => {
    if (item.type !== "fold" || item.from !== from) return [item];
    return rows.slice(item.from, item.to).map((row, offset) => ({ type: "row" as const, row, index: item.from + offset }));
  });
}

export function changeStarts(rows: DiffRow[]): number[] {
  return rows.flatMap((row, index) => (row.kind !== "same" && (index === 0 || rows[index - 1]?.kind === "same") ? [index] : []));
}
