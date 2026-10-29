# Host-Owned Files

## Problem

The development stack ran every process as root. The Dockerfile defined no `USER`, the compose file defined no `user`, and the entrypoint ran `pnpm install` as root. Every file the stack wrote to a bind mount therefore belonged to root on the host. On the development machine the recordings directory and all 17 entries in it were `root:root`, as were `node_modules/`, the pnpm store and `pnpm-lock.yaml` in the repository root. The user could not rename or delete a recording without `sudo`, a second run as a normal user failed with `EACCES`, and the untracked lock file showed up in `git status` permanently.

## Design

Every container process runs with the numeric UID and GID of the person who started the stack. The Makefile reads both values from `id` and exports them; no file contains a fixed UID. Compose refuses to start when either value is missing and tells the user to start the stack with make, because a silent fallback to a default such as 1000 is wrong on some machines and recreates the defect.

The entrypoint starts as root for one reason: named volumes that root already owns on existing machines must be repaired, and only a root step can do that without a manual command. It validates that both values are integers, refuses UID 0, creates a passwd and group entry when the IDs are unknown in the image, and changes the owner of the dependency volumes only when the volume root has a different owner, so a normal start adds less than a second. It then replaces itself with the real command through `setpriv`, with `HOME` set to a dedicated home directory. Application processes never run as root.

The recordings directory and the home directory are re-owned without recursion, because the model client's configuration is mounted read-only below the home directory and a recursive `chown` fails on it. Existing root-owned content is repaired once by an explicit repair target that runs a short-lived root container. A matching check target lists every generated path that does not belong to the caller and exits with code 1, which makes ownership testable.

Further decisions: the pnpm store moves to a named volume, because it is data and does not belong in the repository tree; the host path of the client configuration becomes a setting with a sensible default; the client's auto-updater is disabled, because the global install belongs to root and an update attempt as a normal user only adds noise; and `pnpm-lock.yaml` is tracked so every install resolves the same versions.

## Alternatives rejected

Compose `user:` alone cannot repair a root-owned volume and leaves the process without a passwd entry or a writable home. A fixed `USER` baked in with build arguments ties the image to the identity of whoever built it. Rootless Docker or user namespace remapping is a host-wide daemon change that affects every other project on the machine.

## Risks and acceptance

The main risk was that the model client would fail as a non-root user with a read-only configuration mount, so that was verified before anything else built on it. A UID that already exists in the image (for example 1000 as `ubuntu`) is handled by setting `HOME` explicitly. An interrupted recursive `chown` is repeated on the next start, because the volume root keeps its old owner until the command ends.

The change is accepted when files written below the recordings directory and everything `pnpm install` writes belong to the caller, a stop and start runs without a permission error, the repair target is idempotent, compose stops with a clear message without the identity, and a start with UID 0 exits with code 64. What actually happened during implementation is recorded in "Finding: Container Identity and File Ownership".
