import { describe, expect, it } from "vitest";
import { validateEndpoint } from "./endpoint";

describe("validateEndpoint", () => {
  it.each(["https://cortex.example.com/v1", "http://localhost:18080/v1", "http://127.0.0.1/v1", "http://[::1]:8080/v1", "http://cortex.localhost/v1"])("accepts %s", (url) => {
    expect(validateEndpoint(url).ok).toBe(true);
  });

  it("rejects plain HTTP to other hosts, other schemes and garbage", () => {
    expect(validateEndpoint("http://10.0.0.5/v1")).toEqual({ ok: false, reason: "insecure_http" });
    expect(validateEndpoint("ftp://x/v1")).toEqual({ ok: false, reason: "scheme" });
    expect(validateEndpoint("not a url")).toEqual({ ok: false, reason: "malformed" });
  });
});
