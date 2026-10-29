# Shared public operation protection

## Problem

Two public actions on the site are protected against bots: sending a message and downloading the CV. Each route had its own copy of Turnstile verification and request-origin handling. Reading forwarding headers without one trust policy meant a caller could put any value in a header and influence the rate limit. The two copies also behaved differently on timeouts, hostname checks and provider failures.

## Design

Small server-only helpers now handle bot verification, trusted client identity, safe diagnostics and normalized failures. Each route still owns its limits and public responses, but neither one parses trust headers or talks to the Turnstile protocol directly.

**Turnstile verifier.** One module makes the only server-side Siteverify call. It takes the token, an optional trusted client address and the expected action. It returns one of five outcomes: `verified`, `rejected` (invalid input or action mismatch), `expired` (`timeout-or-duplicate`), `misconfigured` (missing or invalid credentials) or `unavailable` (timeouts, HTTP failures, malformed responses, provider errors). Tokens over Cloudflare's 2048-character maximum are rejected before any network call. The timeout is five seconds. Token, secret, address and raw provider response are never logged. Both routes fail closed. The message widget uses action `message` and the CV widget uses `resume_download`, and a successful response has to carry the matching action. The public bodies did not change: rejection or expiry maps to `verification_failed`. A provider or configuration failure maps to `service_unavailable` for messages and `resume_unavailable` for the CV.

**Trusted client identity.** The trusted header is an explicit setting with three modes:

- `none` ignores every caller-supplied address header.
- `cf-connecting-ip` reads only Cloudflare's single-address header.
- `x-real-ip` reads only a single-address header set by a reverse proxy the operator controls.

`x-forwarded-for` is never parsed, because what its chain means depends on the proxy topology. A header value counts only if Node's IP parser accepts it as exactly one IPv4 or IPv6 address. Development and tests use `none`, and production behind Cloudflare uses `cf-connecting-ip`.

**Privacy.** The raw address goes only to Siteverify and to keyed HMAC derivation. The CMS receives a 64-character client key. When no trusted address exists, the HMAC input is a fixed sentinel, so forged headers cannot change the throttling identity. Message throttling and CV download tracking now share one client-key secret and one derivation helper. CV tracking records store the client key and no longer store a raw IP. A migration redacts the old values before it drops the old field.

The dependencies point one way. A route calls client identity, then the verifier, then its own policy and response mapping. The helpers do not depend on Next route classes.

## Constraints

The application cannot prove that trusted infrastructure set a configured proxy header. Production infrastructure therefore has to block direct origin access and strip inbound copies of the header whenever a trusted mode is on. Hostname allowlisting stays in Cloudflare until the production hostname exists. Global authentication, WAF configuration and a CAPTCHA redesign are out of scope.

## Acceptance

Tests cover these cases:

- Mode `none` ignores every forwarding header.
- Each trusted mode accepts valid IPv4 and IPv6 values and rejects lists and malformed values.
- Equivalent addresses produce stable keys.
- The verifier returns the right outcome for every provider case, including an action mismatch.
- Captured requests and logs contain no raw address or secret.
- Both routes keep their public status and body contracts, and the keyboard and accessible status flows keep working.

The final run passed static checks, both production builds, 39 web tests, 20 CMS unit tests, 4 CMS integration tests and 2 Playwright flows, all in containers. The proxy settings are part of "Validated application configuration".
