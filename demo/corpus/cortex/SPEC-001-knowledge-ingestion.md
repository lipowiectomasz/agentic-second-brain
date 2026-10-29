# Knowledge ingestion and the document lifecycle

## Problem

Ingestion is the only path through which content enters Cortex. The CLI push, the demo seed and accepted spine proposals all go through it; there is no browser editor. It has to solve several problems at once:

- Search must point to a section, not a whole document, so files are split along their structure.
- A reader must never see half of an update, yet VectorsDB and TablesDB cannot be committed in one transaction.
- Several developers write to the same sector from different machines, and sync runs unattended from session hooks. Any rule that asks a human to resolve conflicting text stalls the session.
- Approved specifications and tasks are agreements; silently editing them hides scope changes.
- Document numbers chosen locally collide when two people create a document at the same time.
- Agent knowledge often contains pasted credentials, and a secret that reaches the shared brain is visible to a whole team.

The team decided that writing to the brain must be fully automatic. The first design, with optimistic versioning and local conflict copies, was dropped because it needed a person to reconcile text.

## Document classes

Every file is classified by its path, and each class has exactly one write rule. A write either follows the rule or is refused with a reason the CLI can act on.

- **Immutable** (specifications, backlog tasks): editable only while in `draft`, and only by the author or an organisation admin. From `approved` on, content changes are refused with `immutable`. An admin may fix an approved document in place, for example a typo; the previous version stays in history and the change is recorded in the audit log. A correction is otherwise a new document that declares `supersedes`; when it is approved, the old one becomes `superseded` automatically.
- **Write-once** (findings): created once, one finding per file, with a `relates_to` link to an existing document.
- **Living** (module `AGENTS.md` files, notes): merged three-way on the server. Non-overlapping changes are combined; on overlap the later write wins, the replaced version stays in history and the CLI prints a warning.
- **Personal** (memory): stored under the author's own directory; only the author writes there, so conflicts cannot happen.
- **Spine** (standards, procedures): written by admins only, merged and versioned like living documents. Everyone else submits a proposal that an admin accepts or rejects. Proposals need no maintainer endorsement; the number of pending proposals per person is capped (20 by default).

Any sector maintainer or admin can approve a document.

## Mechanisms

**Status lives outside the file.** `id`, `status`, `supersedes`, `superseded_by` and `relates_to` are server metadata. A status change is a command, not an edit, so it cannot conflict. On pull the CLI renders these keys into the frontmatter; on push they are stripped and never counted in the content hash. Stripping is line based and never re-serialises YAML, so the CLI and the server agree byte for byte on whether a file changed.

**Numbers come from the server.** Reserving a document returns the next free number in the sector; a unique index makes collisions impossible. Gaps are cheaper than coordination.

**Indexes are generated.** `_INDEX.md` is never synced; the CLI builds it from server metadata.

**Full history.** Every stored version of living and spine files, including the first, is written to a versions table in the same transaction as the file row.

**Hash-gated visibility.** Chunks carry the file hash, and readers accept only chunks whose hash matches the file row. Updating the row is the single commit point, so a failure at any step leaves exactly one version visible.

**Superseded documents are hidden.** Search skips `superseded` and `deprecated` documents by default through a metadata filter, with an "include superseded" switch.

## Chunking, embeddings and secrets

The chunker splits Markdown at H1 to H3 headings outside code fences, keeps a heading path such as "Title > Section", merges sections under 200 characters, splits sections over 3000 characters at blank lines (hard limit 6000) and carries a short overlap paragraph into continuation chunks. Each chunk is embedded as title, heading and text into a 768-dimension vector with the built-in embedding model, in batches of 16 with two batches in flight.

Limits keep a file inside one transaction: at most 262144 bytes and 48 chunks, which fits the 100-operation transaction cap for both creation and status updates.

A shared secret scanner runs in the CLI before upload and again on the server. Rules cover cloud access keys, source hosting tokens, chat tokens, private key blocks, JWTs, Appwrite keys, payment live keys, map API keys and a generic assignment rule with an entropy threshold. Obvious placeholders are ignored. Findings report the rule and line with a masked preview, never the value. A file with a secret is always refused, with no way to force it; in the CLI it goes to a local quarantine while the rest of the push proceeds.

## Alternatives rejected

- Last writer wins without merge: loses parallel non-overlapping edits.
- CRDT or operational transform: far beyond scope for Markdown files edited offline.
- Client-side merge: every client would need the base content and the same algorithm, while the server already holds the history.
- Status in the file body: every status change becomes a conflicting edit.
