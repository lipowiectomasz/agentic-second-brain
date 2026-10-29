# Unified Recording Pipeline

## Problem

The recorder had two recording code paths and only one of them worked. The live one built a GIF from the screenshots the automation library keeps for the language model, which gives exactly one frame per step, kept every frame in memory and used one fixed duration for all of them. The other was a 96-line module with a periodic screenshot recorder and a video recorder written against the Playwright page API. Nothing imported it, and `browser-use` 0.13 no longer drives the browser through Playwright at all. The `video` output format produced no file. The requirements allowed any `browser-use` from 0.12.0 upward, although the worker relied on internals that can change with any install. A failed run produced no recording, because encoding happened only after the run returned, and per-task workspace directories piled up in the output directory.

## Design

One pipeline replaces both paths: capture, timeline, encoder. Every output format comes from the same capture and the same timeline, and an encoder is the only format-specific part. Adding video or a smoother timing profile later means adding an encoder or a profile, never a second capture.

Capture uses the Chrome DevTools screencast directly. The screencast pushes a JPEG frame only when the picture changes, with a timestamp, and each frame is acknowledged. Frames are written to disk as they arrive, at most 10 per second and at most 3000 per task, so memory stays flat on long runs. When the browser switches tabs, the capture stops the screencast on the old target and starts it on the new one. Capture can also be paused, which later features use.

The timeline is a pure function. Each frame lasts until the next one, clamped between a minimum of 250 ms and a maximum idle of 2 seconds; frames closer together than the minimum merge into the later image; the last frame is held for 2 seconds. Because it has no I/O, every timing rule has a unit test without a browser or ffmpeg.

The GIF encoder feeds the timeline to ffmpeg through the concat demuxer (repeating the last file line, as the demuxer requires) at 960 px width and 4 fps, with a per-recording palette, which gives smaller files than a fixed palette. ffmpeg is always started with an argument list, never through a shell, with a 120 second timeout.

A driver interface separates "who acts in the browser" from recording. The model-driven driver wraps the library's automation loop. A scripted driver runs a small JSON action list (go to, click, fill, press, scroll, wait, done) with CSS selectors, so recording checks can use real browser actions without a language model and stay stable across library updates. The scripted driver is selected only by a test-only environment variable that the backend never sets.

One session object orchestrates every task: start the browser with a fixed 1280x720 viewport, start capture before the first navigation, run the driver, and in a `finally` block stop capture, build the timeline, run each encoder when there is at least one frame, close the browser and remove the workspace. An encoder failure never hides the driver outcome.

`browser-use` is pinned to exactly 0.13.10, because the capture uses its CDP client, event bus and session helpers, which are not a public, versioned API. Playwright is no longer a worker requirement; the base image keeps Chromium where the library expects it.

## Alternatives rejected

The library's own video recording writes at a fixed 30 fps without timestamps, outputs MP4 only, needs an optional extra and offers no pause hook. Keeping one frame per step cannot show motion. Periodic `Page.captureScreenshot` costs a round trip per frame and competes with the automation for the page. Assembling GIFs with Pillow needs every frame decoded in memory and shares nothing with video.

## Risks and acceptance

A library release that renames the internals breaks every recording; the exact pin and an integration test that fails on the first run after a version change contain this. A static page yields a single frame, which is still a valid timeline. A task with more than about five minutes of continuous motion reaches the frame cap, and the session reports once that later frames are not stored. Output changes from one frame per step to a time-based sequence; the 2 second idle cap equals the old frame duration.

Acceptance: the dead module, the old GIF builder and the Playwright requirement are gone; the reference scenario on the fixture site yields a GIF 960 px wide with at least 12 frames, loop count 0 and at most 3 MB, encoded in under 10 seconds; a scenario with a failing selector still produces a GIF; a link opened in a new tab is captured; no workspace directory remains after a run.
