# Reliable message processing

## Problem

The first version of the contact form, described in "Secure message delivery and persistence", had two correctness gaps in the CMS submission endpoint.

First, duplicate detection was a read-before-create check. Two concurrent requests with the same idempotency key could both see no existing message, and the second create then failed with an uncontrolled unique-key error instead of a clean duplicate response.

Second, the SMTP call and the update to `sent` sat in one `try` block. If SMTP succeeded but the status update failed, the handler entered the SMTP failure path. It could then record a false `failed` state, or throw a second update error. PostgreSQL persistence and SMTP cannot share a transaction, so these boundaries have to be handled explicitly.

## Design

The existing unique index on `messages.requestId` becomes the atomic ownership boundary. The request that successfully creates the `pending` record owns delivery; it is the only one allowed to call `payload.sendEmail()`. When a create fails, the handler looks up the same request ID. If a record exists, the failure was a duplicate and the handler returns the persisted public outcome: `200 sent` for a `sent` message, `202 saved` for `pending` or `failed`. If no record exists, the original error is re-thrown, so unrelated failures are never disguised as duplicates.

Delivery state represents confirmed knowledge only:

- `sent` is written only after SMTP succeeds.
- `failed` is written only after SMTP rejects the delivery.
- If either status write fails, the record stays `pending` and the response is `saved`.
- `deliveryAttemptedAt` is stored with the initial `pending` record, so a stale `pending` record with an attempt time means "result not confirmed".

The public `sent` and `saved` contract is unchanged, so the web route needs no change. No schema change or migration is needed, and no database transaction is held open during SMTP I/O.

## Alternatives rejected

- A dedicated idempotency collection would add stale-claim recovery and a second lifecycle without improving the result.
- A PostgreSQL advisory lock couples the handler to the database and must not span SMTP I/O.
- A new `unconfirmed` state does not help, because writing it can fail just like writing `sent`. The existing `pending` already preserves the uncertainty.
- Automatic retry is unsafe, because an ambiguous SMTP result may already be a delivered email.

## Verification and residual risks

Handler tests use a shared in-memory persistence adapter to reproduce concurrent ownership, SMTP success followed by a failed `sent` update, SMTP failure with both successful and failed `failed` updates, and a repeated failed request that must not invoke SMTP again. All 8 CMS tests passed and the production build passed on Next 15.4.11. A controlled runtime check sent two concurrent requests with one new UUID to the running stack: the responses were `200 sent` and `202 saved`, PostgreSQL held exactly one `sent` record with an attempt timestamp, and Mailpit captured exactly one email. The test record, attempt rows and captured mail were removed afterwards.

Residual risks are accepted and documented. A process crash after SMTP accepts the email can leave a permanently `pending` record that an administrator resolves by checking the mailbox or logs. Concurrent duplicates can each consume a rate-limit slot before ownership is decided, which does not affect the one-record, one-email guarantee. Manual redelivery, an outbox or queue, and a rate-limit redesign are out of scope. Details of how this played out in practice are in "Message retries and ambiguous delivery".
