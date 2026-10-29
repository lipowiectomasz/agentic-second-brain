# Brain map with similarity edges

## Goal

The map is the first screen after login. It shows where knowledge concentrates, which projects solve similar problems and which files have no similar neighbour, and it turns vector similarity into something visible. It also shows sectors a member cannot read, so they know what exists and can ask for access.

- The spine sits at the centre, each readable sector is a cluster in its colour, and each readable file is a node.
- An edge joins two files whose similarity is at least the slider threshold (0.45 to 0.90, default 0.62). The slider filters on the client without refetching.
- Hover or keyboard focus shows a card with the title and sector; a click opens the file preview with its related thoughts.
- Files with no edge at the current threshold stay visible with a dashed outline, explained in the legend as isolated.
- Sectors the caller cannot read appear grey with their name only, no files and no counts, and link to the sector page where access can be requested. The spine is never locked.
- Superseded and deprecated files are left out, with the same rule as search.

## Graph on the server

The graph reuses the search read path: Appwrite filters what the caller may read, and Cortex only computes geometry. Each file is represented by the normalised mean of its first 8 visible chunk vectors, the same rule as related thoughts. Vectors are loaded with a scoped client in groups of 50 file IDs and cached in memory by file ID and content hash (LRU, 2000 entries). Because the key is content-addressed, the cache never goes stale.

Similarity is computed pairwise on every request. With 40 files that is 780 dot products, under 5 ms; at 1000 files about half a million, around 0.4 s. Pairs below a floor of 0.45 are dropped and each file keeps its 6 strongest edges; an edge survives if either end keeps it. The payload sent to the browser contains IDs, titles, paths, sectors and edge weights only, never chunk text or vectors, and stays under 50 KB for the demo data.

Readable sectors come from the caller's memberships, not only from files, so an empty sector the user belongs to is not shown as locked.

## Rendering: deterministic SVG

The first plan used a force-directed canvas library. The final map is an SVG with a fixed 1200 by 760 view box and a layout computed by a pure function:

- the spine in the middle,
- sector anchors on an ellipse,
- files on a sunflower spiral around their sector anchor,
- edges drawn as quadratic curves with a second, thinner pass.

There is no force simulation and no new dependency, so the React 19 compatibility risk disappeared. The same input always produces the same picture, which keeps screenshots and the demo recording stable, and reduced motion is satisfied by design: the only animation is a pulse on active edges, switched off globally. Nodes are SVG links, so the map works with the keyboard, and a visually hidden "Files on this map" list offers the same navigation. Zoom and fit controls were dropped because the map fits the view at the current scale.

SVG is enough for hundreds of files. At thousands, rendering should go back to canvas and pairwise similarity should give way to per-file nearest-neighbour queries.

## Notes

The empty state "The notebook is empty" appears only when there are neither files nor locked sectors; an early version also showed it to users who had sectors to request, which an end-to-end test caught. Filtering chunks by 50 file IDs through a session client works and respects permissions.
