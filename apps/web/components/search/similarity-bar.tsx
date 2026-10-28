export function SimilarityBar({ similarity }: { similarity: number }) {
  const percent = Math.round(Math.min(1, Math.max(0, similarity)) * 100);
  return (
    <span className="sim" aria-label={`${percent}% match`}>
      <span aria-hidden className="sim-track">
        <span className="sim-rest" style={{ width: `${100 - percent}%` }} />
      </span>
      <span className="sim-label">{percent}% match</span>
    </span>
  );
}
