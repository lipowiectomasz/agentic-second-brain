export function LogoMark({ size = 32, title }: { size?: number; title?: string }) {
  const small = size <= 16;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" role={title === undefined ? undefined : "img"} aria-label={title} aria-hidden={title === undefined ? true : undefined}>
      <path d="M24.6 8.2 A11.3 11.3 0 1 0 24.6 23.8" stroke="currentColor" strokeWidth={small ? 3.4 : 3} strokeLinecap="round" />
      <path d="M15.6 16.2 L24.6 8.2" style={{ stroke: "var(--accent)" }} strokeWidth={small ? 2.4 : 2} strokeLinecap="round" />
      <circle cx="15.6" cy="16.2" r={small ? 4 : 3.6} style={{ fill: "var(--accent)" }} />
    </svg>
  );
}
