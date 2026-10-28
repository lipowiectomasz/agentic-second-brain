export class TokenInvalidError extends Error {
  constructor() {
    super("The token is invalid, expired or revoked");
    this.name = "TokenInvalidError";
  }
}

export class TokenRateLimitedError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Too many failed attempts");
    this.name = "TokenRateLimitedError";
  }
}

export class TokenLimitReachedError extends Error {
  constructor(readonly limit: number) {
    super(`You can have at most ${limit} active tokens. Revoke one first.`);
    this.name = "TokenLimitReachedError";
  }
}

export class TokenNotFoundError extends Error {
  constructor() {
    super("Token not found");
    this.name = "TokenNotFoundError";
  }
}

export class TokenSessionError extends Error {
  constructor() {
    super("The token session could not be established");
    this.name = "TokenSessionError";
  }
}
