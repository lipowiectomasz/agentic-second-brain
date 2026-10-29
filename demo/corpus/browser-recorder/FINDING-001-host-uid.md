# Finding: Container Identity and File Ownership

## What was expected

"Host-Owned Files" planned to run every container process as the host user's UID and GID, re-own the shared `node_modules` volume and the pnpm store, and leave the rest of the stack unchanged. The assumption was that all dependencies lived in a single named volume and that the toolchain inside the image would behave the same for any user.

## What happened

Four things did not match the plan.

First, the frontend did not start. It failed with `EACCES` while writing `apps/frontend/node_modules/.vite-temp`. Workspace packages have their own `node_modules` directories on the bind mount, which means on the host, and those still belonged to root. The repair and check lists now cover `apps/*/node_modules`, `packages/*/node_modules` and `e2e/node_modules`, and the list lives in one Makefile variable shared by both targets instead of being hard-coded in the script.

Second, switching the user silently changed the pnpm version. The image had prepared pnpm 9.15.0 under root's home directory. A process running as the host user could not see it, so Corepack downloaded the latest pnpm 12 at start. The fix pins `packageManager: pnpm@9.15.0` in the root `package.json` and points `COREPACK_HOME` at a shared directory readable by every user. Offline, `pnpm --version` now returns 9.15.0. The pnpm version is now pinned in the repository, not only in the image.

Third, the shell helper targets still entered containers as root, because `docker compose exec` defaults to root. A shell opened that way would create root-owned files and break the very verification step the plan relied on. Both shell targets now pass the host identity and the dedicated home directory.

Fourth, the open question resolved positively: the model's command-line client works as UID 1000 with a read-only configuration mount and returns the expected answer with exit code 0. It prints a warning on every call about a missing state file in the home directory, but the warning goes to stderr and does not disturb the output.

## Verification

Checked on the running stack, not only in tests: compose without the UID stops with a message pointing to make; a start with UID 0 exits with 64; repair followed by check exits 0; a root-created file in the recordings directory makes the check exit 1 and name the file; two full recordings with the real model, one through the backend port and one through the frontend, finished as completed with the GIF served with status 200 and owned by the host user; recordings and workspaces were deleted with plain `rm`; a stop and start showed zero `EACCES` lines; all 10 tests passed. A second host user with a different UID was not tested, because the machine has only one user.

## Notes for related work

`browser-use` 0.13.10 downloads and loads default browser extensions at start, including a content blocker and a cookie notice blocker. Some cookie notices therefore already disappear without any code of ours. "Clean Recording Frames" must decide whether these stay, and turning cleaning off must turn them off too, or "record the page as a visitor sees it" is not true. Because the extensions are fetched from the internet on first browser start, offline tests on the fixture site must disable them. The library's default viewport is 1920x1080; "Unified Recording Pipeline" sets 1280x720 explicitly, so frame size will differ from older recordings. The existing worker ran unchanged on 0.13.10, and a 4-step recording of a simple public page took about 70 seconds.
