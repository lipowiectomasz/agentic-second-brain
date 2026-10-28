import { LogoMark } from "./logo-mark";

export function Wordmark({ size = 21 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={Math.round(size * 1.2)} />
      <span className="serif" style={{ fontSize: size, lineHeight: 1.15, letterSpacing: "-0.025em" }}>
        Cortex
      </span>
    </span>
  );
}
