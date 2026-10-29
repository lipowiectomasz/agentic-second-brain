# Next.js (App Router)

Next.js with the App Router. Versions in use: 15.x and 16.x - differences below.

## The server / client boundary

This is the one thing in this framework that really hurts.

- By default **everything is a Server Component**. `'use client'` is added deliberately, at
  the lowest possible level of the tree - not on the page.
- `'use client'` in a component high in the tree turns the whole subtree into client code
  and silently grows the bundle.
- Secrets, API keys and database access **only in Server Components and Route Handlers**.
  A variable without the `NEXT_PUBLIC_` prefix does not reach the browser - but a component marked
  `'use client'` that uses it gets `undefined`, not an error. The symptom is silent.

## Cache

Next aggressively caches `fetch` and route results. A change that "does not work" usually
works - you are just seeing a stale response. When working on fresh data check
`revalidate` and `cache` before you start debugging the logic.

## Verification

Build for production before treating a change as done. `next dev` tolerates things that
`next build` rejects - most often the use of browser APIs in a server component.

## Dev server behind another hostname (Next 16)

`next dev` serves `/_next/*` (client chunks, HMR) only to origins listed in
`allowedDevOrigins`. A page opened through any other hostname - a container name such as
`http://web:3000` in an end-to-end container, a LAN address - still renders on the server, but
the client bundle is blocked: no hydration, forms and buttons do nothing, and the failure looks
like a timing problem in the test. Add the hostname to `allowedDevOrigins` in `next.config.ts`
and keep `/_next/` out of the `proxy.ts` matcher.
