# Public demo on a self-hosted instance

Supersedes: "Public demo on Appwrite Cloud".

## Goals

- Give reviewers a live Cortex instance with the web app, the CLI gateway, the MCP endpoint and the demo data.
- Run the public demo on exactly the same stack as development, so that nothing behaves differently between the machine where a feature was built and the place where it is shown.
- Keep full control over limits, versions and data during judging.

## Decisions

- **Self-hosted Appwrite 2.5.** The public demo runs on a self-hosted Appwrite 2.5 instance, the version the local stack is pinned to. The cloud plan required a preflight to detect version drift; with one version everywhere, that whole class of problems disappears.
- **Built-in embeddings.** The self-hosted instance uses the same built-in embedding model as development. There is no monthly token allowance to exhaust by repeated seeds, and search quality in the demo matches what was measured locally.
- **No plan limits.** Two databases per project (VectorsDB and TablesDB), the function count and transaction sizes are no longer constrained by a free plan, which removes the main open risk of the cloud plan.
- **Behind a reverse proxy.** The instance sits behind a reverse proxy that terminates TLS and forwards the client address. This matters for the CLI gateway: its per-IP rate limit is only trustworthy when the forwarded-for chain comes from a trusted proxy. The CLI keeps refusing plain HTTP for anything but loopback hosts.
- **Same commands.** Provisioning, seed and the smoke checks are the same commands as for local development, pointed at another environment file. The demo is reproduced from the seed, not migrated by hand.
- **Replaces the cloud plan.** The Appwrite Cloud plan is superseded and no longer maintained.

## Open points

- How the web app is served on the instance: through Appwrite Sites on the self-hosted stack or as a separate container next to it.
- Whether function runtimes on the server reach the API through the public endpoint or need the same internal network alias as the local stack (see "Function runtimes cannot reach the API on a local stack").
- Backup and reset routine for the demo data between review sessions, so that the scripted revoke moment of the demo can be replayed.
- Rotation of the demo tokens and the admin key after judging.
