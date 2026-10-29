# Branches

- **Never merge an integration branch** (`stage`, `develop`) into a feature branch.
  It pulls in other people's work in progress and prevents a clean merge into the main branch.
- The direction is one-way: `feature/*` and `fix/*` go **into** the integration branch and **into**
  the main branch, never the other way round.
- Updating a feature branch means **rebasing onto the main branch**, not merging it in.
- **Never `git push`, `push --force`, a merge of a shared branch or a rebase of pushed
  history without explicit permission.** A local commit is fine; anything that changes the remote
  repository is not.

The name of the main branch is per project - check the repository settings, do not assume `main`.
