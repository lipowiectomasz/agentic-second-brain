# Production build depended on a running CMS

## Expected

The production web image is built in CI as part of "Production deployment readiness". The build should be self-contained: install dependencies, compile the Next.js application in standalone mode and produce an image. No other service should have to be running. That matters because the release workflow builds images before anything is deployed, and the CMS that holds the content is not reachable from the build environment.

## What happened

The production build of the web application tried to fetch global site metadata from Payload CMS. The page metadata (title, description and similar values shown in the document head) is produced by `generateMetadata()`, and that function queried the CMS. During `next build` Next.js evaluates metadata for statically generated routes, so the build made a network call to a CMS that was not running. The build either failed or hung on a dependency that had nothing to do with compiling the application.

## Why

`generateMetadata()` had no fallback path. The site already had sensible default metadata, but it was only used in other places. It was not wired in for the case where the CMS request fails. In development the CMS is always running next to the web container, so the coupling never showed up. It only appeared once the build ran in an isolated production image context.

## What changed

The existing default metadata became the fallback inside `generateMetadata()`. When the CMS cannot be reached during the build, the function returns the defaults instead of failing. When the CMS is available at runtime, the CMS values are used as before. The build no longer needs a running CMS, and the running site behaves exactly as it did.

The general lesson for this project: any data fetching in metadata or static generation needs an explicit fallback, or it has to be clearly marked as runtime-only. Otherwise the release gate silently depends on infrastructure it cannot see. The rehearsal that found this also surfaced the problem described in "Readiness marker race in the test dependency container".
