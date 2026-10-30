# Cortex

A shared, permission-aware brain for developer teams and their coding agents, built on
Appwrite VectorsDB and TablesDB.

**Live demo:** [cortex.tomlip.pl](https://cortex.tomlip.pl) - sign in as `demo-reader@example.com`
with the password `Cortex-Demo-2026` (read-only). The admin and maintainer flows are shown in the
video.
**Video:** linked here with the submission. **License:** MIT.

Built for the Appwrite Databases Hackathon (October 2026).

## What it does

Developers who work with coding agents across many projects keep relearning the same lessons:
the bug that cost a day in one project, the rule for how a feature should behave, the deployment
step everyone forgets. Cortex keeps that knowledge in one place and hands it to people and agents
with the right permissions.

- **Spine and sectors.** Organisation-wide standards and procedures form the spine; each project
  is a sector with its own specs, backlog, findings and notes.
- **Search by meaning.** Ask in your own words; results come from every sector you can read.
- **Related thoughts and the brain map.** Files that mean the same thing are linked across
  projects, and the map shows the whole brain at a glance.
- **Access per sector.** Readers and maintainers per sector, access requests, and an admin
  matrix. Removing someone from a sector removes it from their search, map and agent at once.
- **Document lifecycle.** Specs move from draft to implemented, can be superseded, and are
  read-only once approved; findings are written once; living documents merge with full history.
- **Proposals and audit.** Changes to the spine go through proposals reviewed by an admin; an
  append-only audit log records who changed what, from the web, the CLI or the agent.
- **CLI and MCP.** `cortex pull` and `cortex push` keep a local copy in sync, a secret scanner
  stops credentials before they leave the laptop, and `cortex mcp` gives coding agents read
  access with their owner's permissions.

## How Cortex uses Appwrite

| Appwrite feature | What Cortex uses it for |
|---|---|
| **VectorsDB** | Collection `chunks`: every file split into sections, 768-dimension embeddings from Appwrite's built-in embedding service, an `hnsw_cosine` index, metadata filters for sector, kind and status. Search and related thoughts are vector queries. |
| **TablesDB** | Files and their versions, sectors, document ID reservations, access requests, CLI tokens, proposals and the audit log. Writes that touch several tables run in one transaction. |
| **Teams and permissions** | One team per sector with `reader` and `maintainer` roles. Every row and every chunk carries `team:<sector>` permissions, so a query can never return what the caller may not read. |
| **Users and labels** | Accounts, sessions and the organisation admin label. |
| **Functions** | `cli-gateway` checks personal access tokens and serves the CLI and the MCP server with the token owner's permissions. |
| **Sites** | The Next.js web app is built and served by Appwrite Sites (server-side rendering). |

Everything runs on a self-hosted Appwrite 2.5 instance; the public demo uses the same stack as
local development.

## Use Cortex from your projects

### Install the CLI

The CLI runs in a container, so the only requirement is Docker. From a clone of this repository:

```bash
make cli-image
mkdir -p ~/.local/bin
ln -s "$PWD/bin/cortex" ~/.local/bin/cortex
cortex --help
```

Open a new terminal if `cortex` is not found yet (`~/.local/bin` must be on your `PATH`).

### Connect

1. Sign in to the web app and create a personal token under **Account > Access tokens**.
2. Log in and paste the token when asked (or pipe it with `--token-stdin`):

   ```bash
   cortex login --endpoint https://api.cortex.tomlip.pl/v1 --project cortex   # hosted demo
   cortex login --endpoint http://localhost:18080/v1 --project cortex         # your local stack
   ```

The CLI keeps one login at a time in `~/.config/cortex/credentials.json` (mode `0600`); run
`cortex login` again to switch between instances, or `cortex logout` to forget it. The token is
never read from arguments or environment variables.

### Sync your brain

```bash
mkdir -p ~/team-brain && cd ~/team-brain
cortex pull
```

`cortex pull` writes the spine at the sync root and every sector you can read under
`brains/<sector>/`. Edit or add Markdown files there and send them back with `cortex push`.
Writing to a sector needs the maintainer role; changes to the spine go through
`cortex propose`, which an admin accepts in the web app.

| Command | What it does |
|---|---|
| `cortex pull` | writes the spine at the sync root and each sector you can read under `brains/<sector>/` |
| `cortex status` | shows what pull and push would change, files in quarantine and read-only edits |
| `cortex push [--strict] [--delete]` | sends changed files; a file with a secret moves to `.cortex/quarantine/` and the rest is sent |
| `cortex sync` | pull, push, pull |
| `cortex search "<question>"` | meaning-based search with your permissions |
| `cortex reserve spec --create <slug>` | reserves the next document ID and writes the file from a template |
| `cortex status <DOC-ID> approved` | changes a document status |
| `cortex propose <file> --as standard -m "<why>"` | proposes a new or changed spine document |

The server decides per document kind: approved specs and backlog tasks are read-only (create a
superseding document), findings are written once, living documents are merged with full history.
Nothing ever asks you to resolve a conflict. Exit codes: 0 ok, 2 usage, 3 secret found, 5 the
token or role cannot write, 8 sign in again, 10 server unreachable, 11 rejections with `--strict`.

## Coding agents (MCP)

`cortex mcp` is a read-only Model Context Protocol server over stdio. The agent gets three tools,
`search_brain`, `related` and `read_file`, and acts with your permissions: removing you from a
sector removes it from the agent's answers on the next call, and nothing can be written. After
`cortex login`:

```bash
claude mcp add cortex -- docker run --rm -i --network host -u "$(id -u):$(id -g)" \
  -v "$HOME/.config/cortex:/home/cortex/.config/cortex:ro" cortex-cli mcp
```

The credentials directory is mounted read-only and the MCP configuration holds no token. Other
MCP clients use the same command with `"command": "docker"` and the arguments above.

Keep the brain in sync automatically with Claude Code hooks in the sync root's
`.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [{ "hooks": [{ "type": "command", "command": "CORTEX_ROOT=\"$CLAUDE_PROJECT_DIR\" cortex pull --quiet", "timeout": 30 }] }],
    "Stop": [{ "hooks": [{ "type": "command", "command": "CORTEX_ROOT=\"$CLAUDE_PROJECT_DIR\" cortex push --quiet", "timeout": 60 }] }]
  }
}
```

With `--quiet` the CLI prints only warnings, never prompts and does not fail the hook for content
reasons.

## Run your own

### Requirements

- Docker with Compose v2.24 or newer
- GNU Make
- About 8 GB of free disk space and 8 GB of RAM (the embedding model alone takes about 3 GB)

Node.js is not needed on the host: every command runs in a container.

### Quick start

```bash
make appwrite-install
make platform-up
cp .env.example .env          # set CORTEX_CONSOLE_EMAIL
make install bootstrap setup doctor
make app-up                   # development server on http://localhost:13020
make seed                     # optional: demo brain and demo accounts
make site-deploy              # optional: the same app on Appwrite Sites
```

In order: generate the self-hosted Appwrite 2.5 stack, start it with PostgreSQL for VectorsDB
and the embedding service, install dependencies in the tools container, create the console
account, project and scoped API keys, provision databases, the vector collection, tables, the
spine sector and functions, and check the server, a 768-dimension embedding and a function run.

`make bootstrap` writes `APPWRITE_API_KEY`, `CORTEX_WEB_API_KEY` and, on the first run, a
generated `CORTEX_CONSOLE_PASSWORD` into `.env`, printing only the variable names. Running it
again rotates the development key and keeps the web app's key. `make setup`, `make seed` and
`make site-deploy` are idempotent: a second run reports no changes.

### Commands

| Command | What it does |
|---|---|
| `make up` / `make down` | start or stop the platform and the web app together |
| `make platform-up` | start only the Appwrite stack |
| `make app-up` | rebuild and restart the development web app |
| `make lint typecheck test build` | quality gate |
| `make test-integration test-e2e` | integration tests against the `cortex_test` namespace and browser tests |
| `make seed` | load the demo brain and demo accounts |
| `make site-deploy` | build and publish the web app on Appwrite Sites |
| `make demo-check` | scan the demo corpus and this README for secrets and denylisted names |
| `make smoke` | check the published site and API from outside |
| `make backup-db` | dump the Appwrite database to `backups/` |
| `make admin-grant EMAIL=<email>` | give a user the organisation admin label |
| `<target> ENV=<name>` | run any target against `.env.<name>` instead of `.env` |

### Local ports

Defaults bind to `127.0.0.1` only: Appwrite on `18080`, the web app on `13020`, the Appwrite
Sites version on `http://cortex.sites.localhost:18080`. To use other ports, pass them when
generating the stack and keep an untracked `docker-compose.override.yml`:

```bash
make appwrite-install APPWRITE_HTTP_PORT=127.0.0.1:27080 APPWRITE_HTTPS_PORT=127.0.0.1:27443 \
  APPWRITE_MQTT_PORT=127.0.0.1:27883 APPWRITE_MQTT_WSS_PORT=127.0.0.1:27084
```

```yaml
services:
  web:
    ports: !override
      - "127.0.0.1:27020:3000"
```

Update `APPWRITE_ENDPOINT`, `NEXT_PUBLIC_APPWRITE_ENDPOINT` and `CORTEX_SITE_URL` in `.env` to the
chosen port.

Appwrite runtimes cannot reach `localhost`, so `make platform-up` gives traefik the alias
`appwrite-api` on the `runtimes` network, and functions and the site use
`CORTEX_FUNCTION_API_ENDPOINT=http://appwrite-api/v1` on every instance.

### Manual bootstrap

If `make bootstrap` exits with code 2, the console API of your server version differs. Create the
same resources by hand in the Appwrite console at `http://localhost:18080`:

1. Sign up (the first account becomes the only console user).
2. Create a project with the ID `cortex`.
3. Add a Web platform with the hostname `localhost`.
4. Create API keys named `cortex-dev` and `cortex-web` with the scopes listed in
   `packages/infra/src/key-scopes.ts`, and put them into `.env` as `APPWRITE_API_KEY` and
   `CORTEX_WEB_API_KEY`.
5. Continue with `make setup`.

## Deploy to a server

The public demo runs the same stack on a single server behind Nginx Proxy Manager, which
terminates TLS for two hosts: the app (Appwrite Sites) and the Appwrite API. Only `/v1` is public
on the API host; the Appwrite console is reached through an SSH tunnel.

1. Copy `.env.public.example` to `.env.public` and set the two domains.
2. Generate and harden the stack, then start it on the proxy's Docker network:

   ```bash
   make appwrite-install appwrite-public-config ENV=public APPWRITE_DOMAIN=<api host> PUBLIC_IP=<server ip>
   make platform-up ENV=public PROXY_NETWORK=<proxy network>
   ```

3. `make install bootstrap setup seed site-deploy smoke ENV=public`.
4. In the proxy, point both hosts at `appwrite-traefik:80` and return 404 for everything but `/v1`
   on the API host.

After that, GitHub Actions takes over: the `quality` job runs lint, type checks, unit tests, the
build and a rehearsal of the deploy scripts on every push and pull request, and every push to
`main` deploys over SSH. A deploy-only key may run nothing but `bin/deploy-remote`, which
fast-forwards the server to the exact commit behind a lock, backs up the database, rebuilds and
runs `make smoke`.

## Repository layout

| Path | Contents |
|---|---|
| `apps/web` | Next.js application |
| `functions/*` | Appwrite Functions (`cli-gateway`, `health`), bundled with esbuild |
| `packages/access` | sectors, roles, access requests |
| `packages/knowledge` | ingestion, chunking, embeddings, search, related thoughts, document lifecycle |
| `packages/tokens`, `packages/gateway-contract` | personal access tokens and the gateway API |
| `packages/proposals`, `packages/audit` | spine proposals and the audit log |
| `packages/cli` | the `cortex` CLI and MCP server |
| `packages/config`, `packages/core`, `packages/server-kit` | environment schemas, domain rules, Appwrite clients |
| `packages/infra` | bootstrap, schema provisioning, seed, site deploy, smoke and demo checks |
| `demo/` | the demo corpus, its seed manifest and the video scenario |
| `bin/` | the CLI wrapper and the deploy scripts |
| `appwrite/` | self-hosted Appwrite stack from the official installer, plus the public overlay |

## License

MIT
