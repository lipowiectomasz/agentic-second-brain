import { describe, expect, it } from "vitest";
import { smokeChecks } from "./smoke";

function fakeFetch(routes: Record<string, { status: number; location?: string; body?: string }>) {
  return (url: string) => {
    const route = routes[url];
    if (route === undefined) return Promise.reject(new Error(`unreachable ${url}`));
    return Promise.resolve({ status: route.status, headers: { get: (name: string) => (name === "location" ? (route.location ?? null) : null) }, text: () => Promise.resolve(route.body ?? "") });
  };
}

const healthy = {
  "https://cortex.example.com/": { status: 307, location: "/login?next=%2F" },
  "https://cortex.example.com/login": { status: 200 },
  "https://cortex.example.com/status": { status: 200 },
  "https://api.example.com/v1/health/version": { status: 200, body: '{"version":"2.5.0"}' },
  "https://api.example.com/": { status: 404 },
  "https://api.example.com/console": { status: 404 },
};

describe("smokeChecks", () => {
  it("passes a healthy public instance", async () => {
    const results = await smokeChecks("https://cortex.example.com/", "https://api.example.com/v1", fakeFetch(healthy));
    expect(results.filter((result) => !result.ok)).toEqual([]);
    expect(results).toHaveLength(6);
  });

  it("fails when the console is reachable or the site is down", async () => {
    const results = await smokeChecks("https://cortex.example.com", "https://api.example.com/v1", fakeFetch({ ...healthy, "https://api.example.com/console": { status: 200 }, "https://cortex.example.com/login": { status: 500 } }));
    expect(results.filter((result) => !result.ok).map((result) => result.name)).toEqual(["site /login answers", "console /console is not public"]);
  });

  it("reports an unreachable host instead of throwing", async () => {
    const results = await smokeChecks("https://down.example.com", "https://api.example.com/v1", fakeFetch(healthy));
    expect(results[0]).toMatchObject({ ok: false });
    expect(results[0]?.detail).toContain("unreachable");
  });
});
