export const sectorColors = {
  "sector-1": "#1b6a6b",
  "sector-2": "#4a4ea0",
  "sector-3": "#5a6814",
  "sector-4": "#843a74",
  "sector-5": "#86590b",
  "sector-6": "#335f8c",
  "sector-7": "#366b42",
  "sector-8": "#7d5236",
} as const;

export type SectorColorToken = keyof typeof sectorColors;

export const sectorColorTokens = Object.keys(sectorColors) as [SectorColorToken, ...SectorColorToken[]];

export function sectorColorHex(token: SectorColorToken): string {
  return sectorColors[token];
}

export function sectorColorToken(hex: string): SectorColorToken | null {
  const match = Object.entries(sectorColors).find(([, value]) => value === hex.toLowerCase());
  return match === undefined ? null : (match[0] as SectorColorToken);
}

export function sectorColorVar(hex: string): string {
  const token = sectorColorToken(hex);
  return token === null ? hex : `var(--${token})`;
}
