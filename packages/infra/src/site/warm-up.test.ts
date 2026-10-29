import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { SiteDeployError } from "./archive";
import { warmUp } from "./warm-up";

const noWait = () => Promise.resolve();

describe("warmUp", () => {
  let close: () => void = () => undefined;

  afterEach(() => close());

  async function serve(statuses: number[]): Promise<{ origin: string; hosts: string[] }> {
    const hosts: string[] = [];
    let call = 0;
    const server = createServer((request, response) => {
      hosts.push(request.headers.host ?? "");
      response.statusCode = statuses[Math.min(call, statuses.length - 1)] ?? 200;
      call += 1;
      response.end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    close = () => server.close();
    return { origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, hosts };
  }

  it("retries a cold start until the site answers, sending the site host", async () => {
    const { origin, hosts } = await serve([500, 307]);
    await warmUp(origin, "cortex.sites.localhost", ["/"], 10000, noWait);
    expect(hosts).toEqual(["cortex.sites.localhost", "cortex.sites.localhost"]);
  });

  it("fails after the limit when the site keeps failing", async () => {
    const { origin } = await serve([502]);
    await expect(warmUp(origin, "cortex.sites.localhost", ["/"], 0, noWait)).rejects.toBeInstanceOf(SiteDeployError);
  });
});
