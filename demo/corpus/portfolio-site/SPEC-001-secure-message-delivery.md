# Secure message delivery and persistence

## Goal

The contact form on the portfolio site used to fake a successful response. This change replaces it with a real server-side flow: every accepted submission is stored in Payload CMS first and only then announced to the owner with one text-only SMTP notification. A mail outage must never lose a visitor's message, and the public form must not become an abuse channel for bots, markup injection or email header injection.

Responsibilities are split between the two applications. The Next.js web application owns the browser interaction, the request size cap, bot verification with Cloudflare Turnstile, a honeypot field and privacy-preserving client identification. Payload CMS owns authoritative validation, moderation, persistence, access control, throttling, idempotency and email delivery. The web route forwards normalized input to the CMS through an authenticated server-to-server request; the shared secret is compared in constant time.

## Design decisions

- **Persist before sending.** The CMS creates the message with status `pending`, calls `payload.sendEmail()` and then updates the same record to `sent` or `failed`. Raw SMTP error text is never stored; only a safe failure category (`configuration`, `connection`, `rejected`, `timeout`, `unknown`).
- **Settings in CMS, credentials in the environment.** Recipient, subject prefix, enablement, blocked terms and rate-limit values live in a private `message-settings` global that the owner can edit without a deployment. SMTP host, port, TLS mode, credentials and sender exist only as server environment variables, because CMS fields are database data and end up in backups.
- **Text-only email, visitor address only as `replyTo`.** Submitted content can never become executable mail markup, and the authenticated sender stays compatible with SPF and DMARC.
- **Delivery through the official adapter.** `@payloadcms/email-nodemailer` is pinned to 3.86.0 to match the Payload family. Connection and greeting timeouts are 3 seconds, the socket timeout 8 seconds, and the whole route must fail within 10 seconds. Locally, Mailpit v1.31.0 captures mail inside the Compose network, which is why SMTP authentication is optional only as a complete username and password pair.
- **Durable throttling without raw IPs.** The web route derives an HMAC-SHA-256 client key from the trusted client address. The CMS stores one attempt row per new valid idempotency key in a hidden collection and evaluates a rolling window (default 3 submissions per 60 minutes). In-memory limits were rejected because they reset on restart and differ between instances.
- **Idempotency.** The browser sends a UUID v4 idempotency key. A repeated key returns the existing public outcome without creating a second record or sending a second email. There is no automatic resend.
- **Delivery in an endpoint, not a hook.** An `afterChange` hook was rejected because admin edits could trigger unintended email.

## Validation and content policy

Field limits are counted in Unicode code points after NFKC normalization: name 2-100, subject 3-160, message 10-4000, email 3-254, Turnstile token up to 2048. The web route accepts only `application/json` and caps the body at 8 KiB before parsing. Both boundaries validate, but only the CMS result is authoritative.

The content policy rejects control characters, CR or LF in single-line fields, HTML and encoded tag openers, script schemes, event handlers, template markers, URL-like content (including spaced and bracketed dot obfuscation), high-confidence SQL and shell sequences, and configured offensive terms. Offensive-term matching uses a normalized comparison form (NFKC, lowercase, diacritic folding, digit substitutions, separator collapsing) on token boundaries; the comparison form is never stored. Database safety still relies on parameterized Payload APIs, not on pattern detection. The test corpus deliberately includes Polish and English recruitment prose that looks technical, to keep false positives low.

## Public contract and privacy

The browser receives `200 sent`, `202 saved` or one of a fixed set of errors: `invalid_request` (400), `verification_failed` and `content_rejected` (403), `rate_limited` (429), `form_disabled` and `service_unavailable` (503). A `saved` response after an SMTP failure tells the visitor the message is kept, so they do not create duplicates by retrying. Status changes are announced with `aria-live`, invalid fields use `aria-invalid`, and rejected submissions keep the entered values.

Logs contain only the request ID, outcome and an internal error category, never message text, email, token, client address, client key or secrets. Anonymous users cannot use any standard collection operation over REST or GraphQL; authenticated administrators can read and delete messages. Automatic retention is deferred, so old messages are removed manually.

## Acceptance and known risks

Acceptance requires a valid browser submission to produce one CMS record and one captured text email, a forced SMTP failure to leave one `failed` record, concurrent requests with one key to produce one record and one email, the rolling limit to be exceeded and then released, and anonymous access to be denied. The main residual risk is SMTP accepting the email while the status update fails; the record then stays `pending` and is resolved by hand. That case is refined in "Reliable message processing". A small burst can also slip past the rate limit because no per-client lock is taken; Turnstile remains an independent layer.
