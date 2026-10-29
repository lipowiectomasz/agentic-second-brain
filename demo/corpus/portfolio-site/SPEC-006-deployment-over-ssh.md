# Automated production deployment over SSH

## Problem and goal

The release workflow from "Production deployment readiness" checks `main` and publishes the web and CMS images under one immutable commit SHA, and then it stops. An operator still has to connect to the server, update the checkout and run the deployment script. That delays every release, and the checked-out source or the image tag can drift away from the commit that actually passed the release gate.

The goal is one extra workflow job. Once both images are published, GitHub Actions connects to the Ubuntu 24.04 host over SSH, checks out exactly that commit and runs the existing deployment script with the same SHA. Automated and manual releases keep using a single deployment implementation.

## Design decisions

- **The merge is the approval.** The job runs only on a push to `main` in the original repository. It is bound to a protected production environment whose branch policy allows only `main` and has no required reviewer.
- **Immutable identity.** The only data in the remote command is the 40-character lowercase hexadecimal commit SHA and the validated application directory. Mutable tags such as `latest` are rejected.
- **A remote release wrapper.** On the host, a small script checks the SHA before any Git command uses it. It fetches `main` without tags, confirms that the object is a commit and an ancestor of `origin/main`, checks it out in detached mode and then hands over to the deployment script. Malformed input exits with code 2, and the deployment script's own exit code is passed through. Tracked files are never reset. If a tracked file has unexpected changes, the release stops rather than deleting the operator's work. Ignored files such as the production environment file and dumps are left alone.
- **Two layers of serialization.** GitHub concurrency serializes production jobs with `cancel-in-progress: false`. On the host, deploy and rollback both take the same non-blocking `flock` lock and fail before changing anything if another run holds it. That also covers manual runs.
- **Strict SSH.** The job uses the system OpenSSH client instead of a third-party action. The private key goes into a temporary directory with mode `0600`, which is removed on every exit path. Host identity comes from a pre-verified known-hosts entry with `StrictHostKeyChecking=yes`. The fingerprint is checked against the provider console from a trusted workstation and never scanned inside the job. Connection and keepalive timeouts are finite.
- **Secrets stay where they live.** Connection material exists only as environment-scoped secrets, exposed as step environment variables rather than expanded in shell source. The production environment file and the registry login stay on the host and are never sent over SSH. Package write permission is limited to the publish job.
- **No automatic dump and no automatic rollback.** Dumps stay a manual step for risky releases. Rollback stays manual because a completed migration can make the previous image incompatible.

Other options were rejected for these reasons. A self-hosted runner on the server would add a persistent code-execution agent. Building on the host would duplicate CI and weaken artifact provenance. Shipping the environment file from CI would create a second secret store.

## Risks

Docker access on the host is effectively root, so a leaked deployment key compromises the whole host. That risk is accepted for one small host and reduced by a dedicated key, environment scoping, the branch policy, no log output and immediate rotation if exposure is suspected. Planned host-key rotation means updating the known-hosts secret before deployments can resume. Strict validation of each connection value prevents shell injection through malformed configuration.

## Acceptance

Workflow syntax passes actionlint 1.7.7, and every production shell script passes ShellCheck 0.11.0, both in pinned containers. Tests must cover missing and malformed SHAs, a commit outside `main`, a checkout with tracked changes, exit code propagation, lock contention and lock release on interruption. An SSH rehearsal against an isolated target must reject a mismatched host key, and a failed image publication must prevent the deploy job. The first live run must show that the workflow SHA, the detached HEAD on the host and the running image tags all match, and that health endpoints, CMS login, message delivery and CV download work.
