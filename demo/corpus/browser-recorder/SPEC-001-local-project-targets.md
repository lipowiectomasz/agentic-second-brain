# Recording Local Projects

## Problem

The recorder's browser runs inside a container. The projects a developer works on run on the same machine, behind a host reverse proxy (Caddy) that listens on `127.0.0.1` only. From inside the recorder container, an address such as `http://shop.localhost` resolves to the container itself, because Chromium maps every `*.localhost` name to the loopback address of its own network namespace. A task against a local project therefore records a browser error page and still ends as a normal run.

Two obvious workarounds fail. Using the container name as the address (`http://shop-web:3000`) changes the `Host` header, so development servers that check the host, such as Vite, reject the request, and applications that build absolute links produce links the user cannot open. Reaching the host proxy through `host.docker.internal` does not work either, because the proxy binds to loopback, and changing its bind address would expose every local project to the Docker bridge.

## Design

The goal is that the user types the same `http://<name>.localhost` address they open in their normal browser, and the project receives the same `Host` header as in daily use.

The recorder gets its own route to selected project containers. A dedicated external Docker network is shared by the recorder and by the projects that opt in. A small gateway container (Caddy, plain HTTP, no published port, no certificates) joins that network and routes only the host names that a per-project definition file names. Every other `*.localhost` name gets status 404 with a marker header that means "not connected". The definition files live in a git-ignored directory, so the allow list is local to each machine.

Chromium is started with a host resolver rule that maps every `*.localhost` name to the gateway address. One rule covers every connected project, and public names never match it, so public recording is unchanged by construction. Only the gateway joins the shared network; the backend, frontend and worker get no direct route to project containers.

A project connects with one network entry in its own local override file. Its ports, services and behaviour stay the same, and it still starts while the recorder stack is stopped. The gateway compose file is loaded only when at least one definition exists, because a missing external network breaks every compose command, and the recorder must start on a machine that has never set up local targets. The network is created with an explicit subnet, since the default Docker address pool runs out on machines with many projects.

Rejected alternatives: host networking for the backend (the model-controlled browser would then reach every service on the host loopback, including databases and admin tools of unrelated projects), and generating routes from Docker labels (it needs a Docker socket mount in the gateway, which is less safe than a small file per project).

## Pre-run check

Before the browser starts, the worker classifies the target address. A `http` address ending in `.localhost` goes through the gateway. `localhost`, `127.0.0.1` and `[::1]` are rejected with a hint to use the `.localhost` project address, because "localhost" means the host to the user and the container to the browser, and a silent wrong page is worse than a message. `https://<name>.localhost` is rejected with "Use http:// for local projects." Everything else is public and passes without a request.

For local targets the worker sends one request to the gateway with the target `Host` header and a 5 second timeout. No answer gives the reason code `target_unreachable`; the not-connected header gives `target_not_connected`; status 502, 503 or 504 means the project behind the gateway is down and also gives `target_unreachable`. A status 500 counts as reachable: the project answered, and a recording of its error page is a valid result. A failed check ends the task as failed before any browser process starts, and the outcome banner described in "Reliable Task Outcome" shows the reason. The form also shows a hint whenever the target looks local.

## Constraints and risks

The whole design rests on Chromium applying the resolver rule to `*.localhost` names, so the first implementation step verifies it with a throwaway probe container. If it fails, the fallback keeps the gateway and only changes the name suffix inside the recorder.

A connected project is reachable by a browser that a language model controls, including admin pages that need no login in development. The guide states this, and only explicitly connected projects are reachable. A syntax error in one definition file stops the gateway, so every local target then reports the gateway as unreachable. Deleting the shared network while a project references it breaks that project's compose commands. Pages that call a second local host, such as a separate API host, need that host connected too.

## Acceptance

A task against a connected `http://<name>.localhost` address records the project, and `location.host` inside the page is still the user's address. A public target behaves as before. A connection survives restarts of both stacks. An unconnected name or a stopped project ends as failed with the matching reason, within 10 seconds, and no browser starts. The README section "Recording local projects" lists every step. HTTPS for local targets, projects running without Docker, automatic discovery and a management UI are out of scope.
