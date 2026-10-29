# Docker and compose

Almost every project here runs on compose.

- **Named volumes for data, bind mounts for code.** A bind mount over `node_modules` in the container
  overwrites what the build installed, and gives missing-module errors despite a correct
  `package.json`.
- Variables in `.env`, never in `docker-compose.yml`. The compose file is in the repository.
- After changing the `Dockerfile` or dependencies you need `--build`. A plain restart runs
  the old image, and it looks like a change that did not work.
- When debugging check `docker compose logs -f <serwis>`, not only the application output -
  container startup failures do not show up anywhere else.

## Tools container instead of Node on the host

Every `npm`, `npx`, test, build and CLI command runs in a one-off service
(`docker compose run --rm tools ...`), wrapped in Make targets so nobody types the long form.

- **Run as the host user**: `user: "${HOST_UID:-1000}:${HOST_GID:-1000}"`, with the Makefile
  passing `HOST_UID=$(shell id -u) HOST_GID=$(shell id -g)`. Do not name the variables `UID` and
  `GID`: `UID` is read-only in bash, and `UID=... docker compose` fails before compose starts.
  Without a matching user, files created in the bind mount belong to root.
- **Give it a home on a named volume** (`HOME` points at the volume, `npm_config_cache` inside it). The npm
  cache and CLI login sessions survive between runs.
- **Split the service when part of the work needs another stack's network.** A service that
  declares an external network fails to start until that network exists. Keep `tools` without
  the network for install, lint, tests and builds, and a `tools-net` service on the external
  network for commands that talk to the other stack. Both use the same image.
- Put the services behind a `tools` profile so `docker compose up` does not start them.

## Local port overrides

Published ports in the tracked compose file are defaults, bound to `127.0.0.1`. A developer whose
machine already uses them keeps an untracked `docker-compose.override.yml` (listed in
`.gitignore`) and replaces the list with `!override`:

```yaml
services:
  web:
    ports: !override
      - "127.0.0.1:27020:3000"
```

Without `!override` compose appends the ports to the default ones instead of replacing them.
A Makefile that passes explicit `-f` files must add the override itself
(`$(if $(wildcard docker-compose.override.yml),-f docker-compose.override.yml,)`), because
compose loads it automatically only when no `-f` is given.
