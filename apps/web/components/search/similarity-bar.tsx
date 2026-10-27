export function SimilarityBar({ similarity }: { similarity: number }) {
  const percent = Math.round(Math.min(1, Math.max(0, similarity)) * 100);
  return (
    <span className="flex items-center gap-2 text-xs" aria-label={`${percent}% match`}>
      <span aria-hidden className="h-1.5 w-16 overflow-hidden rounded bg-neutral-200">
        <span className="block h-full bg-orange-700" style={{ width: `${percent}%` }} />
      </span>
      {percent}% match
    </span>
  );
}
