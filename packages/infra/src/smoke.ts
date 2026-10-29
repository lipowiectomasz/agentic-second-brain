export interface SmokeResult {
  name: string;
  ok: boolean;
  detail: string;
}

type FetchLike = (url: string, init: { redirect: "manual"; signal: AbortSignal }) => Promise<{ status: number; headers: { get(name: string): string | null }; text(): Promise<string> }>;

function summarize(result: { status: number; location: string | null; body: string }): string {
  if (result.status === 0) return result.body;
  return `${result.status} ${result.location ?? ""}`.trim();
}

async function probe(fetchImpl: FetchLike, url: string): Promise<{ status: number; location: string | null; body: string }> {
  try {
    const response = await fetchImpl(url, { redirect: "manual", signal: AbortSignal.timeout(20000) });
    return { status: response.status, location: response.headers.get("location"), body: await response.text() };
  } catch (error) {
    return { status: 0, location: null, body: error instanceof Error ? error.message : String(error) };
  }
}

export async function smokeChecks(siteUrl: string, apiEndpoint: string, fetchImpl: FetchLike): Promise<SmokeResult[]> {
  const site = siteUrl.replace(/\/+$/, "");
  const api = apiEndpoint.replace(/\/+$/, "");
  const results: SmokeResult[] = [];
  const root = await probe(fetchImpl, `${site}/`);
  results.push({ name: "site redirects to sign in", ok: root.status >= 300 && root.status < 400 && (root.location ?? "").includes("/login"), detail: summarize(root) });
  for (const pathname of ["/login", "/status"]) {
    const page = await probe(fetchImpl, `${site}${pathname}`);
    results.push({ name: `site ${pathname} answers`, ok: page.status === 200, detail: summarize(page) });
  }
  const health = await probe(fetchImpl, `${api}/health/version`);
  results.push({ name: "api answers", ok: health.status === 200 && health.body.includes("version"), detail: summarize(health) });
  for (const pathname of ["/", "/console"]) {
    const page = await probe(fetchImpl, `${new URL(api).origin}${pathname}`);
    results.push({ name: `console ${pathname} is not public`, ok: page.status !== 0 && page.status !== 200 && !(page.status >= 300 && page.status < 400), detail: summarize(page) });
  }
  return results;
}
