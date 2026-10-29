# Meaning search, file preview and related thoughts

## Problem

Search is the main way people and tools reach knowledge in Cortex. Keyword search misses documents that describe the same idea in other words, and a list of titles does not tell you where the answer is. Knowledge from one project often solves a problem in another, but nobody knows to look for it. Finally, any search path that runs with an API key would bypass document permissions, so that path must not exist.

The same functions serve the web app, the CLI `cortex search` command and the MCP server that coding assistants use, so every client sees exactly the same results for the same person.

## Search

A query of 1 to 500 characters is embedded and sent to VectorsDB as a cosine vector query, optionally filtered by sector and document kind. The vector query, the file reads and the manifest listing all run with a caller-scoped client (a web session or a short-lived JWT), so Appwrite itself drops chunks the caller cannot read. Only the query embedding uses the admin client, because embeddings need a key; that call carries no document data. A unit test asserts that the read functions never receive the admin client.

The search over-fetches three times the requested limit, then:

- drops chunks whose metadata fails validation,
- keeps only chunks whose file hash matches the current file row (no half-updated versions),
- hides `superseded` and `deprecated` documents unless "include superseded" is on; the chunk metadata is a prefilter and the file row status is authoritative, because chunk status may lag after a supersede,
- keeps at most 2 chunks per file and cuts to the limit.

Each result carries the sector, file, title, heading, a 200-character snippet, an anchor and a similarity in [0, 1].

Query embeddings are cached in process memory (LRU of 200 entries). Targets: p95 under 800 ms on a cache miss, under 300 ms on a hit.

## Web experience

- Ctrl+K (Cmd+K on macOS) opens a search palette on every authenticated page; arrows move, Enter opens, Esc closes. Sector and kind chips filter without navigation. Input is debounced by 300 ms and a newer request cancels an older response.
- A result opens the file preview scrolled to the matched heading. Anchors use the same slug algorithm as the Markdown renderer, so they always match.
- The preview renders sanitised Markdown with no raw HTML and safe links. The header shows the document ID and status; a superseded document shows a "Superseded by" banner linking to the replacement.
- A related thoughts panel lists up to 5 chunks from other files. It uses the mean of up to 8 chunk vectors of the current file, which represents the whole file better than its introduction, excludes the file itself and keeps one result per file.
- The palette and the panel have distinct loading, empty and error states. A file the caller cannot read returns the not-found page.

## Risks considered

- Vector queries might be refused for session or JWT callers. This was verified first with two test users; the fallback would have moved permission filtering into application code.
- Selecting only metadata might drop the distance field; checked during the same probe.
- Metadata filters applied after approximate HNSW search can return fewer results than requested; the over-fetch factor covers the demo path.

Hybrid keyword and vector ranking, saved searches and precomputed related lists were left out: on-demand queries are fast enough and precomputed lists would need invalidation on every ingest.
