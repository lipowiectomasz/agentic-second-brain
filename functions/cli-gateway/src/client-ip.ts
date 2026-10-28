export function clientIp(headers: Record<string, string | undefined>): string {
  const forwarded = headers["x-appwrite-client-ip"] ?? headers["x-forwarded-for"]?.split(",")[0] ?? headers["x-real-ip"];
  const value = forwarded?.trim() ?? "";
  return /^[0-9a-fA-F.:]{2,45}$/.test(value) ? value : "unknown";
}
