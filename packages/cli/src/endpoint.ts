const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function validateEndpoint(value: string): { ok: true; url: URL } | { ok: false; reason: "scheme" | "insecure_http" | "malformed" } {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (url.protocol === "https:") return { ok: true, url };
  if (url.protocol !== "http:") return { ok: false, reason: "scheme" };
  const host = url.hostname.toLowerCase();
  return loopbackHosts.has(host) || host.endsWith(".localhost") ? { ok: true, url } : { ok: false, reason: "insecure_http" };
}
