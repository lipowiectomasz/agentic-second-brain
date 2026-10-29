# Message retries and ambiguous delivery

## Expected

"Reliable message processing" set out to guarantee that one contact form submission produces exactly one stored message and at most one email, even with concurrent duplicates and partial failures. The initial plan assumed this would need extra machinery: a separate collection to claim ownership of a request, and possibly a new delivery state for results that were not confirmed.

## What happened

Neither addition turned out to be necessary. The existing unique index on `messages.requestId` already gave an atomic ownership claim. Whichever request creates the record owns delivery, and a create conflict followed by a lookup of the same ID identifies a duplicate. Using it removed a whole extra lifecycle (claims that go stale and need recovery) and needed no migration.

A dedicated "unconfirmed" state was also dropped. A `pending` record with `deliveryAttemptedAt` set already means "delivery was attempted but the result is not confirmed". A separate state would add no certainty, because the write that sets it can fail just like the write that sets `sent`.

## Why it holds, and what remains

The automated test reproduces concurrent conflicting writes on a shared in-memory adapter. That proves the handler logic but not the real database, so the actual PostgreSQL unique index and Mailpit capture were checked with a controlled test against the running environment. Integration tests that would modify the shared development database were deliberately not run. A repeatable suite against an isolated database was left as follow-up work.

One known side effect stays. Parallel duplicates can each use up a rate-limit slot before an owner is chosen. That does not weaken the guarantee of one record and one email, and changing how rate limits are counted was outside the scope of this work.

## What changed

The handler now uses the unique index as the ownership boundary and records the attempt time on the initial `pending` record. It never writes `failed` after a successful SMTP call, and it never retries automatically, because an ambiguous SMTP result may already be a delivered email. Stuck `pending` records are resolved by hand by checking the mailbox or logs, which is the trade-off accepted in "Secure message delivery and persistence".
