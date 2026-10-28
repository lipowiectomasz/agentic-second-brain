import type { ReactNode } from "react";

const shapes = {
  check: <path d="m3 8.5 3 3 7-7" />,
  pencil: <path d="M10.5 2.5l3 3L6 13H3v-3Z" />,
  progress: <path d="M8 2v3M8 11v3M2 8h3M11 8h3" />,
  implemented: <path d="m3 8.5 3 3 7-7M2 13h12" />,
  superseded: <path d="M13 8H3M7 4 3 8l4 4" />,
  deprecated: <path d="M3 13 13 3M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Z" />,
  lock: (
    <>
      <rect x="3" y="7" width="10" height="7" rx="1" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" />
    </>
  ),
  info: (
    <>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 7.2v4M8 4.6v.4" />
    </>
  ),
  warning: (
    <>
      <path d="M8 1.8 15 14H1Z" />
      <path d="M8 6.5v3.2M8 11.6v.3" />
    </>
  ),
  danger: (
    <>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 4.5v4M8 10.8v.4" />
    </>
  ),
  pending: <path d="M5 8h.01M8 8h.01M11 8h.01" />,
  cross: <path d="m4 4 8 8M12 4l-8 8" />,
  withdrawn: <path d="M6 4 2.5 7.5 6 11M3 7.5h7a3.5 3.5 0 0 1 0 7H9" />,
  standard: <path d="M2.5 13.5V2.5l11 11Zm3-3.5v.5h1M2.5 6h1.5M2.5 9h1.5" />,
  procedure: <path d="M6.5 4h7M6.5 8h7M6.5 12h7M2.5 4h1M2.5 8h1M2.5 12h1" />,
  menu: <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />,
  copy: (
    <>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1" />
      <path d="M10.5 3.5v-1h-8v8h1" />
    </>
  ),
  document: <path d="M4 1.5h5.5L12.5 4.5v10h-8.5ZM9 1.5v3.5h3.5M6.5 8.5h4M6.5 11h4" />,
  history: <path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 2.5v2.5H5M8 5v3.2l2 1.3" />,
  unfold: <path d="M5 6l3-3 3 3M5 10l3 3 3-3" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof shapes;

export function Icon({ name, size = 16, strokeWidth = 1.6 }: { name: IconName; size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {shapes[name]}
    </svg>
  );
}
