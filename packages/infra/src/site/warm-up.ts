import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { SiteDeployError } from "./archive";

export function statusFor(origin: string, domain: string, pathname: string): Promise<number> {
  const url = new URL(pathname, origin);
  const request = url.protocol === "https:" ? httpsRequest : httpRequest;
  return new Promise((resolve) => {
    const call = request(url, { method: "GET", headers: { Host: domain }, timeout: 15000 }, (response) => {
      response.resume();
      resolve(response.statusCode ?? 0);
    });
    call.on("timeout", () => call.destroy());
    call.on("error", () => resolve(0));
    call.end();
  });
}

export async function warmUp(origin: string, domain: string, paths: string[], limitMs: number, sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms))): Promise<void> {
  const deadline = Date.now() + limitMs;
  const pending = new Set(paths);
  let last = 0;
  while (pending.size > 0) {
    for (const pathname of [...pending]) {
      last = await statusFor(origin, domain, pathname);
      if (last >= 200 && last < 400) pending.delete(pathname);
    }
    if (pending.size === 0) return;
    if (Date.now() >= deadline) throw new SiteDeployError("warm_up_failed", `${[...pending].join(", ")} answered ${last}`);
    await sleep(2000);
  }
}
