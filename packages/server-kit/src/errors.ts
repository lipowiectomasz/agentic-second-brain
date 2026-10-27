import { AppwriteException } from "node-appwrite";

export class UnauthenticatedError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends Error {
  constructor(readonly reason: string) {
    super(`Forbidden: ${reason}`);
    this.name = "ForbiddenError";
  }
}

export class RateLimitedError extends Error {
  constructor() {
    super("Too many attempts");
    this.name = "RateLimitedError";
  }
}

export function mapAppwriteAuthError(error: unknown): UnauthenticatedError | RateLimitedError | Error {
  if (error instanceof AppwriteException) {
    if (error.code === 429) return new RateLimitedError();
    if (error.code === 401 || error.code === 404) return new UnauthenticatedError();
  }
  return error instanceof Error ? error : new Error("Unknown authentication error");
}
