# Cortex

A shared, permission-aware brain for developer teams and their coding assistants, built on
Appwrite VectorsDB and TablesDB.

> Work in progress for the Appwrite Databases Hackathon (October 2026).

## Requirements

- Docker with Compose v2.24 or newer
- GNU Make
- About 8 GB of free disk space for images, the embedding model and volumes

Node.js is not needed on the host: every command runs in a container.

## Quick start

```bash
make appwrite-install
make platform-up
cp .env.example .env
make install
make bootstrap
make setup
make doctor
make app-up
```

In order: generate the self-hosted Appwrite 2.5.0 stack (`appwrite/docker-compose.yml`,
`appwrite/.env`), start Appwrite with PostgreSQL for VectorsDB and the embedding service, create
`.env` and set `CORTEX_CONSOLE_EMAIL`, install workspace dependencies in the tools container,
create the console account, organisation, project and a scoped API key, provision databases,
the vector collection, tables, the spine sector and functions, check the server version,
a 768-dimension embedding and a function run, and start the web app on `http://localhost:13020`.

`make bootstrap` writes `APPWRITE_API_KEY` (and a generated `CORTEX_CONSOLE_PASSWORD` on the
first run) into `.env`. It prints only the names of the variables it wrote. Running it again
reuses the account and project and rotates the key.

`make setup` is idempotent: a second run reports `0 changes`. A column whose existing definition
differs from the declaration is reported as drift and nothing is changed.

## Commands

| Command | What it does |
|---|---|
| `make up` / `make down` | start or stop the platform and the web app together |
| `make platform-up` | start only the Appwrite stack |
| `make app-up` | rebuild and restart only the web app |
| `make lint`, `make typecheck`, `make test`, `make build` | quality gate |
| `make test-integration` | integration tests against the `cortex_test` namespace |
| `make test-reset` | delete and recreate the test namespace, remove `test-` users and teams |
| `make shell` | shell in the tools container |
| `make setup ENV=<name>` | run any command against `.env.<name>` instead of `.env` |

Integration tests refuse to run unless the namespace ends with `_test`.

## Local ports

Defaults bind to `127.0.0.1` only: Appwrite on `18080`, the web app on `13020`. To use other
ports on your machine, pass them when generating the stack and keep an untracked override:

```bash
make appwrite-install APPWRITE_HTTP_PORT=127.0.0.1:27080 APPWRITE_HTTPS_PORT=127.0.0.1:27443 \
  APPWRITE_MQTT_PORT=127.0.0.1:27883 APPWRITE_MQTT_WSS_PORT=127.0.0.1:27084
```

Then create `docker-compose.override.yml` (ignored by git):

```yaml
services:
  web:
    ports: !override
      - "127.0.0.1:27020:3000"
```

Update `APPWRITE_ENDPOINT` and `NEXT_PUBLIC_APPWRITE_ENDPOINT` in `.env` to the chosen port.

## Command line

The CLI runs from a container image; Node is not needed on the host.

```bash
make cli-image
export PATH="$PWD/bin:$PATH"
cortex login --endpoint http://localhost:18080/v1 --project cortex
cortex pull
```

Create a personal token under **Account > Access tokens** in the web app and paste it when asked
(or pipe it with `--token-stdin`). The token is stored in `~/.config/cortex/credentials.json`
with mode `0600`; it is never read from arguments or environment variables.

| Command | What it does |
|---|---|
| `cortex pull` | writes the spine at the sync root and each sector you can read under `brains/<sector>/` |
| `cortex status` | shows what pull and push would change, files in quarantine and read-only edits |
| `cortex push [--strict] [--delete]` | sends changed files; a file with a secret moves to `.cortex/quarantine/` and the rest is sent |
| `cortex sync` | pull, push, pull |
| `cortex search "<question>"` | meaning-based search with your permissions |
| `cortex reserve spec --create <slug>` | reserves the next document ID and writes the file from a template |
| `cortex status <DOC-ID> approved` | changes a document status |

The server decides per document kind: approved specs and backlog tasks are read-only (create a
superseding document), findings are written once, living documents are merged with full history.
Nothing ever asks you to resolve a conflict. Exit codes: 0 ok, 2 usage, 3 secret found, 5 the
token or role cannot write, 8 sign in again, 10 server unreachable, 11 rejections with `--strict`.

Keep the brain in sync with Claude Code hooks in the sync root's `.claude/settings.json`:

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

## Coding assistant (MCP)

`cortex mcp` is a read-only Model Context Protocol server over stdio. The assistant gets three
tools - `search_brain`, `related` and `read_file` - and acts with your permissions: removing you
from a sector removes it from the assistant's answers on the next call, and nothing can be
written. Sign in once with `cortex login`, then:

```bash
claude mcp add cortex -- docker run --rm -i --network host -u "$(id -u):$(id -g)" \
  -v "$HOME/.config/cortex:/home/cortex/.config/cortex:ro" cortex-cli mcp
```

The credentials directory is mounted read-only and the MCP configuration holds no token. Other
MCP clients use the same command with `"command": "docker"` and the arguments above.

## Functions on a local stack

Appwrite runtimes cannot reach `localhost`. `make platform-up` adds traefik to the `runtimes`
network under the alias `appwrite-api` (`appwrite/docker-compose.runtimes.yml`), and `make setup`
passes `CORTEX_FUNCTION_API_ENDPOINT` (default in `.env.example`: `http://appwrite-api/v1`) to the
CLI gateway function. On a server with a public domain, leave the variable unset.

## Manual bootstrap

If `make bootstrap` exits with code 2, the console API of your server version differs. Create the
same resources by hand in the Appwrite console at `http://localhost:18080/console`:

1. Sign up (the first account becomes the only console user).
2. Create a project with the ID `cortex`.
3. Add a Web platform with the hostname `localhost`.
4. Create an API key named `cortex-dev` with the scopes listed in
   `packages/infra/src/key-scopes.ts`, and put it into `.env` as `APPWRITE_API_KEY`.
5. Continue with `make setup`.

## Repository layout

| Path | Contents |
|---|---|
| `apps/web` | Next.js application |
| `functions/*` | Appwrite Functions, bundled with esbuild |
| `packages/config` | environment schemas, validated once at start-up |
| `packages/core` | domain enums and permission builders |
| `packages/server-kit` | Appwrite clients and call timeouts |
| `packages/infra` | bootstrap, schema provisioning, doctor |
| `appwrite/` | self-hosted Appwrite stack from the official installer |

## License

MIT
