# Automated Verification Harness

## Problem

A recording task depends on a language model and on external websites, and both are slow and not repeatable. The project had five API validation tests, one render test and some unit tests for the model client bridge, and nothing checked the path from the form to the downloaded file. The backend parsed worker output with `JSON.parse` and read untyped fields, so a renamed field failed silently. The frontend repeated the backend types by hand. The Python tests used `unittest` and were not part of the regular test command. No test could produce a failed, crashed or hanging task on demand.

## Design

The harness separates two questions. "Does the application handle each worker outcome correctly?" is answered by a fake worker in seconds. "Does the recorder produce a correct file?" is answered by the real recorder on a local fixture site, without a language model.

A shared contracts package holds Zod schemas for the HTTP API and the worker line protocol, and TypeScript types derive from them, so backend, frontend and tests cannot drift. Any breaking change fails the type check everywhere at once, which is intended. Worker lines are parsed by a function that never throws and returns nothing for empty lines, invalid JSON or schema mismatches, behind a line splitter that handles chunk boundaries and flushes a final line without a trailing newline before the exit code is read. A single Python emitter writes worker messages for both the real and the fake worker. The prompt gets a limit of 4000 characters.

The fake worker is a deterministic Python stand-in launched exactly like the real one, so tests exercise process spawn, stream parsing and exit handling. It reads a scenario marker of the form `[[fake:<name>]]` from the prompt, compares it with a fixed registry and executes nothing from the prompt. The initial scenarios are success (five progress messages 200 ms apart, then a sample GIF), failed, crash (exit code 3 without a result) and hang (wait until SIGTERM). Later features register more scenarios without touching the dispatcher. A marker in the prompt was preferred over a request field, so production code never carries a test-only field.

Two independent guards keep the fake out of normal use: the backend refuses to start in fake mode unless `NODE_ENV=test`, and the UI shows a permanent banner whenever the fake worker is active.

The fixture site is plain static files with no external resources: a page with a sticky header, a bottom cookie notice, a debug bar and a CSS carousel; a gallery of six lazy-loaded images; a login form with a "show password" toggle and an account page; a page that redirects to another host name; and a page that echoes a query parameter. Each obstacle uses a saturated, unique marker colour, so tests can find it in a quantised GIF palette. The fixture login uses a fixed test-only pair and no real credentials. A pytest fixture serves the site on a free loopback port, with a second host name for redirect tests.

## Isolation

The browser suite uses Playwright 1.58.0, pinned to the Playwright version of the base image so the matching Chromium build is already present. It runs in its own compose project with its own volumes, so it can run alongside the development stack, and all services sit on a Docker network with `internal: true`, which makes "no test needs the internet" a property of the setup rather than a convention. The test browser shares the frontend's network namespace, so it opens the app on localhost and the Vite host check accepts it. All task output goes to a separate test output directory, never to the real recordings directory. A failed test leaves a screenshot, a trace and a video.

Rejected: mocking the HTTP API in browser tests (it skips the backend, the spawn and the parser); a fake language model inside the real worker (it must answer with element indexes from the live DOM and breaks on every library update); a shared multi-project test container (this project only tests itself).

## Risks and acceptance

The fake worker being enabled by accident is the high risk, covered by the two guards. The contracts package exports TypeScript source, which works with tsx, Vite and Vitest but would need a build step for a production image. A Playwright patch release can drift from the image. The suite duration grows as features add tests.

Acceptance: one command runs the full browser suite and exits 0 only when every test passes; it covers creation, progress, result, download, retry and discard; it finishes in under 120 seconds; it needs no internet; the fake worker has no randomness; each scenario has a test for its visible result; the recordings directory is untouched. Tests against the real model, continuous integration and visual regression tests are out of scope.
