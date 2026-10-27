import { AppwriteException } from "node-appwrite";
import { describe, expect, it } from "vitest";
import { RateLimitedError, UnauthenticatedError, mapAppwriteAuthError } from "./errors";

describe("mapAppwriteAuthError", () => {
  it("maps invalid credentials and unknown users to the same error", () => {
    expect(mapAppwriteAuthError(new AppwriteException("x", 401, "user_invalid_credentials"))).toBeInstanceOf(UnauthenticatedError);
    expect(mapAppwriteAuthError(new AppwriteException("x", 404, "user_not_found"))).toBeInstanceOf(UnauthenticatedError);
  });

  it("maps 429 to RateLimitedError", () => {
    expect(mapAppwriteAuthError(new AppwriteException("x", 429, "general_rate_limit_exceeded"))).toBeInstanceOf(RateLimitedError);
  });

  it("passes other errors through", () => {
    const error = new Error("boom");
    expect(mapAppwriteAuthError(error)).toBe(error);
  });
});
