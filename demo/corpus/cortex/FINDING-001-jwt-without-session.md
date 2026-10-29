# JWT works without a live session

Relates to: "Personal access tokens and the CLI gateway".

## Symptom

The CLI gateway acts as a token owner through a JWT minted with `users.createJWT({ userId, sessionId })`, using a session dedicated to that token. The design assumed that revoking a token could delete that session and every JWT minted from it would stop working at once.

During integration testing on Appwrite 2.5.0 the gateway kept working in a case that should have failed: a JWT minted for a session that had already been deleted, or for a `sessionId` that never existed, was accepted. Calls such as `account.get` and `listRows` succeeded with it.

## Cause

`users.createJWT` does not check that the given `sessionId` refers to a live session. Deleting a session invalidates only the JWTs that were issued before the deletion. A JWT issued afterwards, against the same (now missing) session ID, is valid for its full lifetime.

So "delete the session" is not a revocation mechanism on its own: anything that can still mint a JWT for that user can keep acting as them.

## Resolution

Revocation security does not depend on deleting the session. It rests on two rules:

- The token authenticator checks the token's revocation time and expiry before every use, including when a cached JWT is reused. A revoked or expired token gets the same 401 `token_invalid` on the next request.
- The JWT never leaves the gateway function. Callers only ever hold their personal access token, so there is no JWT in the wild that bypasses the check.

The session is still deleted on revocation, but only as tidiness. The planned "session disappeared, create a new one" recovery path practically never runs; session eviction (Appwrite keeps 10 sessions per user by default and evicts the oldest) is handled by clearing the cached JWT and retrying once after a 401.

## Takeaway

When a JWT is minted with the server SDK, treat the session ID as a label, not as a binding. Any authorisation that must be revocable needs its own state check before each use.
