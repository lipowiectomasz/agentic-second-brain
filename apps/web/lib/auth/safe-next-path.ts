export function safeNextPath(raw: string | null | undefined): string {
  if (raw === null || raw === undefined || raw === "") return "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/";
  return raw;
}
