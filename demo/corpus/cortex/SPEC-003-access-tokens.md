# Personal access tokens and the CLI gateway

## Problem

The CLI and the MCP server act on behalf of a developer without a password. They must never hold an Appwrite API key: server SDKs using a key bypass document permissions, so a developer tool with a key would see every sector. Three platform details shape the design:

- `users.createJWT` defaults to the user's most recent session, and the JWT dies with it. A CLI user may have no session at all, and a web logout would break the CLI.
- An Appwrite execution record keeps request headers, path and response body. A token in an `Authorization` header could be readable by anyone with execution read access.
- Nothing from which the full token can be recovered may be stored.

## Tokens

A developer creates a token in the web app with a name, a scope (`read` or `write`) and an expiry of 7, 30 or 90 days. The full value is shown once; afterwards the list shows only a display prefix, the scope, creation and expiry dates and when it was last used. A user may hold at most 10 active tokens. An organisation admin sees every token with its owner and can revoke any of them.

The token has a fixed marker, an 8-character random prefix (40 bits) and a 43-character random secret (32 bytes). The database stores the prefix and the SHA-256 of the full token, compared in constant time. SHA-256 is enough because 256 bits of entropy make offline guessing infeasible; a slow password hash would only add latency.

## The gateway

The CLI and the MCP server call a single Appwrite Function, the CLI gateway. The token travels only in the JSON request body, never in a URL, header, log line, error message or audit entry, and the function runs with logging disabled. Bodies over 1 MiB are rejected before parsing.

After verifying the token, the gateway acts as its owner through a JWT minted from a dedicated session for that token. The JWT lives 900 seconds, is cached in memory until 60 seconds before expiry and never leaves the function. Read routes use a client built from that JWT, so Appwrite filters results by the owner's sectors; removing someone from a sector takes effect on the next request. A `read` token gets 403 `token_scope` on any write route. If Appwrite rejects a cached JWT mid-route, the gateway clears the cache, authenticates again and retries once.

Every failure (unknown prefix, wrong secret, revoked, expired) returns the same 401 `token_invalid`, so there is no oracle for valid prefixes. 10 failures from one client IP within 15 minutes, or 5 for one token prefix, lock that IP or prefix for 15 minutes with 429 `rate_limited` and a retry hint. `lastUsedAt` is written at most once every 5 minutes.

## Verified platform behaviour

A verification probe on Appwrite 2.5.0 with logging disabled and synchronous execution showed that the request body, custom headers and the response body are not persisted in the execution record. The path is persisted together with its query string, so nothing sensitive may appear in it. The client address arrives in a dedicated Appwrite header derived from the forwarded-for chain; it is trustworthy only behind a trusted proxy, which is why the per-prefix limit exists as an independent brake.

Revocation does not rely on deleting the session. See "JWT works without a live session": the security of revocation rests on checking token state before every use.

## Alternatives rejected

- An API key per developer: bypasses permissions and has no per-user scope.
- Appwrite magic tokens exchanged for a session: the CLI would hold a full-rights session secret with no read-only scope.
- A web route handler as the gateway: kept as a fallback, not needed once the probe passed.
