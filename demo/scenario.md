# Cortex demo video

Target length 2:45, hard limit 2:50. Narration in English, about 2.5 words per second. Each
scene lasts as long as its narration plus half a second; scenes are joined with a 0.4 s
crossfade, and each act opens with a one-second title card.

## Opening (0:00-0:45)

**Screen:** title card "Cortex - a shared brain for teams and their coding agents", then the
brain map slowly panning, no interaction.

> Hi, I'd like to show you my application, built on Appwrite and its vector database.
> In my daily work as a developer I use AI agents across many projects, sometimes on the same
> technology stack, sometimes on a different one. The main problem is sharing what we learn:
> the problems we run into, and how a feature should behave so that it stays consistent from
> one application to the next. The second problem is sharing that knowledge with other
> developers in the team or the company, whether they work on the same projects or on
> different ones. That's how the idea was born: for this hackathon I built my own second brain
> for sharing knowledge and standards between projects in a team and a company.

## Act 1 - Under the hood (0:45-1:15)

Title card: "1 - Built on Appwrite".

| # | Screen | Narration |
|---|---|---|
| 1.1 | Console, project overview, cursor over the `vectorsdb` requests | It all runs on a self-hosted Appwrite 2.5 instance. |
| 1.2 | TablesDB visualizer of `cortex_tables` | TablesDB holds the structure: files and versions, sectors, tokens, proposals and an append-only audit log, written in transactions. |
| 1.3 | VectorsDB panel: `embeddings_cosine` index and one chunk with `team:` permissions highlighted | Every file is chunked and embedded by Appwrite's built-in model into VectorsDB, with an HNSW index. Each chunk carries its team's permissions. |
| 1.4 | Function `cli-gateway`, then site `cortex-web` | A function is the gateway for the CLI and coding agents, and the web app runs on Appwrite Sites. |

## Act 2 - The brain (1:15-1:55)

Title card: "2 - One brain, many projects".

| # | Screen | Narration |
|---|---|---|
| 2.1 | Map as `demo-maintainer`, cursor over three nodes | Standards in the middle, projects around them, lines between files that mean the same thing. Interview Coach is locked: I'm not on that team. |
| 2.2 | Ctrl+K, typing "files created by a container end up owned by root", results | I ask in my own words, and Cortex finds a Browser Recorder finding and spec about container user IDs. |
| 2.3 | Open the finding, scroll to related thoughts | Related thoughts link the same problem to our Docker standard and the deployment procedure. |
| 2.4 | Admin window: set `demo-maintainer` in Portfolio Site to None; maintainer reloads the map, Portfolio locked | Access is per sector. One change by an admin, and the sector is gone from my map, my search and my agent. |

## Act 3 - A real task (1:55-2:37)

Title card: "3 - Everyday work with an agent".

| # | Screen | Narration |
|---|---|---|
| 3.1 | Terminal in the `browser-recorder` repository, Claude Code with the task "add an ownership check to the verification script" | Now a real task in the Browser Recorder repository. |
| 3.2 | Claude Code calls `search_brain` and `read_file`, cites the Docker standard and the finding, writes the check | The agent asks Cortex through MCP, with my permissions, follows our standard and the earlier finding, and writes the check. |
| 3.3 | `cortex reserve finding ...`, Claude fills it, `cortex push`: one file sent, `notes/scratch.md` quarantined | It records what it learned as a new finding. Push sends only what changed and stops a file with a token before it leaves my laptop. |
| 3.4 | Browser: the new finding on the map, then the audit log entry | The finding is already on the map, and the audit log shows who added it and from where. |

## Closing (2:37-2:47)

**Screen:** end card with the live demo link, the repository and "Built on Appwrite VectorsDB,
TablesDB, Functions and Sites".

> Cortex: one brain for a team and its agents. The live demo is linked below.

## Preparation

- `make demo-reset demo-rehearse` green before every take.
- Screen 1920x1080, dark theme, browser zoom 110 %, notifications off, terminal font 18.
- Browser profiles for `demo-maintainer` and `demo-admin`; no personal accounts visible in the
  access matrix.
- A sync root pulled as `demo-maintainer`, Claude Code with the `cortex` MCP server added,
  `browser-recorder` on a clean branch.
- `notes/scratch.md` generated just before the take; it is never committed.
- Act 3 is recorded live; acts 1 and 2 are recorded by script and timed to the narration.
