import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const paper = "#f4efe4";
const ink = "#1d2a44";
const vermilion = "#c23a1c";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: paper }}>
        <svg width="112" height="112" viewBox="0 0 32 32" fill="none">
          <path d="M24.6 8.2 A11.3 11.3 0 1 0 24.6 23.8" stroke={ink} strokeWidth="3" strokeLinecap="round" />
          <path d="M15.6 16.2 L24.6 8.2" stroke={vermilion} strokeWidth="2" strokeLinecap="round" />
          <circle cx="15.6" cy="16.2" r="3.6" fill={vermilion} />
        </svg>
      </div>
    ),
    size,
  );
}
