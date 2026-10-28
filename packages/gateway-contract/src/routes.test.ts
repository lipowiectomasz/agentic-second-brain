import { describe, expect, it } from "vitest";
import { errorCodeSchema, gatewayRequestSchema, routes, statusForCode } from "./index";

const token = `cbt_abcdefgh_${"A".repeat(43)}`;

describe("gateway contract", () => {
  it("accepts a well formed request and rejects a malformed token", () => {
    expect(gatewayRequestSchema.safeParse({ auth: token, input: {} }).success).toBe(true);
    expect(gatewayRequestSchema.safeParse({ auth: token.replace("abcdefgh", "ABCDEFGH"), input: {} }).success).toBe(false);
    expect(gatewayRequestSchema.safeParse({ auth: token.slice(1), input: {} }).success).toBe(false);
  });

  it("maps every error code to an HTTP status", () => {
    expect(errorCodeSchema.options.map(statusForCode)).toEqual([400, 401, 403, 403, 404, 409, 413, 422, 429, 500]);
  });

  it("declares the whoami route as a read route under /v1", () => {
    expect(routes.whoami).toMatchObject({ path: "/v1/whoami", access: "read" });
    expect(routes.whoami.input.safeParse({ extra: 1 }).success).toBe(false);
  });
});
