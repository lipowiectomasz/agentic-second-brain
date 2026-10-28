import { formatCount } from "@/lib/nav-count";

export function NavCount({ count, compact = false }: { count: number; compact?: boolean }) {
  const label = formatCount(count);
  if (label === null) return null;
  return (
    <span className={compact ? "count count-tab" : "count"} aria-label={`${count} pending`}>
      {label}
    </span>
  );
}
