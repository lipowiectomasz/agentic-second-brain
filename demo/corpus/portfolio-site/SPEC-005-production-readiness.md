# Production deployment readiness

## Problem and goal

The existing Compose stack was a development runtime only. It bind-mounted source code, installed dependencies when containers started, ran development servers, exposed application ports and included Mailpit. It had no production images, no release automation, no migration order, no pre-change database dump and no immutable target to roll back to.

The goal is the first public release of the site: a Next.js web application, Payload CMS 3.86.0 and PostgreSQL on one Ubuntu 24.04 LTS host. Everything runs from immutable artifacts. Authoritative data persists, secrets stay out of images and tracked files, and deployment, migration, health checks, a manual dump and rollback can be repeated. Feature work is integrated on a `stage` branch, but only commits accepted on `main` can produce a production release. A separate staging environment was deliberately left out.

## Design decisions

- **Immutable image pair.** Multi-stage images for web and CMS use Next.js standalone output and are tagged with the same commit SHA. A release workflow on `main` runs the existing container quality gate and critical tests first, and only then publishes both images to the container registry. Images hold runtime artifacts and production dependencies only, run as non-root where possible, and never install or compile anything at startup.
- **Two layers of proxying.** Nginx Proxy Manager, which lives outside the repository, terminates public HTTPS and forwards traffic to a Caddy container inside the stack. Caddy is an HTTP-only router published only on a private or loopback address. PostgreSQL and the application ports stay on private networks. Nginx Proxy Manager overwrites the client-address header before forwarding, which "Shared public operation protection" requires.
- **One domain, two Next.js applications.** The CMS is built with `basePath: '/admin'`, and the Payload admin route is set to `/`, so the panel stays at `/admin`. CMS APIs, GraphQL, media and Next assets all live under `/admin`. Caddy routes `/admin` and `/admin/*` to the CMS without stripping the prefix and sends everything else to web. This had to be verified against Payload 3.86.0 before image work started, because a naive setup produces `/admin/admin`.
- **Migrations as an explicit step.** The first release accepts a short maintenance window. The operator takes a manual dump, stops traffic, runs migrations once, starts the selected image pair and runs smoke tests. A failed migration stops the rollout before the application starts.
- **Manual dump, not backups.** A helper runs `pg_dump` and writes a timestamped dump into a gitignored directory on the host. It must never leave an empty or partial file that looks like a success. Scheduled backups, retention, off-host storage and automated restore are out of scope.
- **Rollback picks an earlier image pair.** Rollback selects a previously published release and stops with a clear warning when database compatibility is not guaranteed. Database restore is never automated.

## Constraints

Health checks must not query large collections or call external providers. Deployment output and logs must not expose database, SMTP or CMS secrets, shared operation secrets or raw client addresses. Production also needs real SMTP, a Turnstile hostname restriction and the trusted-header setup. Kubernetes, multi-host setups, zero-downtime blue-green deploys and a full observability platform are out of scope.

## Acceptance and status

An isolated rehearsal with throwaway volumes covered the work so far. It built both images with no secrets in build arguments or layers and checked web routes, `/admin`, `/admin/_next/*`, `/admin/api/graphql`, media and login redirects. It confirmed that data and media survive container replacement, that migrations run once and block the rollout on error, that the dump helper writes one valid file, and that an earlier image pair can be selected. The images, routing, Compose stack, health endpoints, helper scripts and the main-only publication workflow are done.

Live acceptance on the real host is still open. It needs a chosen VPS provider, the proxy, production SMTP, Turnstile and a signed-off launch checklist. What went wrong during the rehearsal is in "Production build depended on a running CMS" and "Readiness marker race in the test dependency container". Automating the final rollout step is covered by "Automated production deployment over SSH".
