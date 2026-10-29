# Validated application configuration

## Problem

Both applications, the Next.js site and Payload CMS, read environment variables directly in routes, query clients and CMS setup, often with permissive fallbacks. Messaging, Turnstile, CMS connectivity, resume download and email each had their own reads. An empty secret or a malformed URL therefore surfaced late, as a user-facing failure on a public form instead of a startup error. There was also no clear line between variables that are safe to expose to the browser and server-only secrets.

## Goal and design decisions

Each application consumes configuration through one validated boundary that returns immutable, typed objects, validated once per process.

- **Dependency-free loaders.** Each application has its own small TypeScript loader rather than a schema library, so diagnostics stay fully under control.
- **Strict parsing.** Empty strings count as missing. Booleans, ports, URLs, origin lists and secrets are parsed strictly; weak or example-looking secrets are rejected.
- **Validate at startup.** The web application validates in Next.js `instrumentation.ts`; the CMS validates before `buildConfig()`.
- **Build time versus runtime.** Public build-time configuration is kept separate from server runtime configuration. Client components receive the Turnstile site key through props instead of reading `process.env` themselves.
- **Capability flags.** Messaging and resume download each have an explicit enable flag. A disabled capability does not require its secrets and returns a safe "unavailable" state instead of crashing.
- **Conditional requirements.** The CMS message capability requires SMTP settings, but credentials are optional only as a complete username and password pair, which supports a local Mailpit without authentication and a real production SMTP server.
- **Sanitized diagnostics.** Error messages name the variable and the expected type, never the configured value.

Development, test and production requirements are documented as separate matrices through environment examples and Compose wiring.

## Constraints

No production code outside the configuration boundary may read `process.env`, except where Next.js itself needs it for runtime selection. All runtime-dependent commands run only inside Docker containers. A hosted secret manager, secret rotation, production orchestration and editing transport credentials from the CMS are out of scope.

## Acceptance

Table-driven tests cover missing and empty values, invalid URLs, ports, booleans and origin lists, weak secrets and conditional requirements. Diagnostic tests assert that the message contains the variable name and expected type and that the configured value is absent. Feature-flag tests show that disabled capabilities start without their secrets and expose safe unavailable behavior. Messaging, resume download and CMS clients import only validated configuration. The approach was later extended by "Shared public operation protection", which added the proxy trust mode and the shared client-key secret to the same boundary.
