# CLI synchronisation of the local knowledge tree

## Problem

Before Cortex, each developer attached a different set of per-project knowledge repositories. Access equalled repository access, so removing a person from one project meant editing git permissions. Secrets pasted into a knowledge file travelled to every clone. Generated indexes and status lines in frontmatter were the most frequently conflicting lines, and with sync running unattended from session hooks, any prompt or conflict file is a stalled session.

## Solution

The `cortex` CLI replaces those repositories with one sync root. `cortex login` stores a personal access token once; afterwards the session-start hook of the coding assistant runs `cortex pull --quiet` and the session-stop hook runs `cortex push --quiet`, so writing to the brain is automatic. Every call goes to the CLI gateway function, which acts as the token owner, so the CLI sees exactly what the person sees in the web app. The CLI holds no API key and no session, and talks to the gateway with plain `fetch` instead of the SDK.

Commands: `login`, `logout`, `status`, `pull`, `push`, `sync`, `search`, `reserve`, a status change command and `propose` for spine proposals.

- **pull** writes the spine at the root and each readable sector in its own directory. A second pull with no server change touches no file. A sector that disappears from the manifest is moved to a revoked area with a timestamp and a warning.
- **push** sends only new files and files whose body hash, without managed frontmatter, changed since the last sync. Per file the server answers `created`, `updated`, `merged`, `overwritten`, `unchanged` or `rejected`. The CLI applies returned content for merges, prints the history version kept for overwrites, and never writes conflict files.
- **Immutable refusal.** Editing an approved specification is rejected with the document ID and a hint to reserve a new number and declare `supersedes`. The local edit is kept and listed by `status` until resolved.
- **reserve** asks the server for the next free document number and can create the file from a template.
- **Generated indexes.** `_INDEX.md` is generated on pull from server metadata, marked as generated, read-only and never pushed.
- **Deletes** happen only with `--delete`; a missing file is more often a mistake than an intent.

## Safety rules

- The token is never read from arguments or environment variables, which show up in process lists and shell history. The credentials file must have mode 0600 inside a 0700 directory; the CLI refuses a file readable by group or others.
- Plain HTTP is refused unless the host is a loopback address.
- Every path from the server is validated (no `..`, no absolute path, `.md` only, resolved inside the target directory); a violation aborts the pull.
- Before sending, every file is scanned for secrets. A file with a finding moves to a local quarantine directory with mode 0700 and is reported by path and line; the rest is sent. Exit code is 0 with a warning, or 3 with `--strict`. The gateway repeats the scan; the CLI check is a convenience, not the boundary.
- `--quiet` prints single warning lines, never prompts, and exits non-zero only on authentication failure or an unreachable server, so a hook never blocks a session.

## Behaviour observed

Three-way merge works end to end without server changes: two working copies with disjoint edits produce `merged` and both fragments end up in the file. The first write on a cold function takes about 1 to 3 seconds because of CPU embedding; a pull with no changes is a single manifest call. Pull and push run at most 4 requests in parallel with a 30 second timeout and one retry on network errors or 5xx. The CLI ships as a container image built from a single bundled file, so no Node runtime is needed on the host.

The quarantine scenario exposed a gap in the generic secret rule; see "Secret scanner missed prefixed variable names".
