# Reliable Task Outcome

## Problem

The worker reported success whenever the browser automation loop returned. That loop returns normally in three very different situations: when it declares the task done, when it gives up, and when it runs out of steps. The user saw "completed" in all three. The backend made it worse: a worker that exited with code 0 and no result line also became `completed`. There was no time limit on a task at all; a timeout setting existed in the configuration and was never read. The failed view showed only text, even when frames had been captured. Retry kept the prompt but dropped the target address, the format and the step limit. And a site that redirected to a login page or another host produced a recording that looked correct while showing something else.

## Design

Lifecycle and outcome become separate fields. The status says whether the worker is still running (`queued`, `running`, `finished`); the outcome says what the run achieved: `succeeded`, `partial` or `failed`. The old `completed` and `failed` statuses disappear, because "failed" meant both "the process died" and "the task was not achieved".

The outcome comes from evidence, evaluated by a pure function in a fixed order. A stop signal gives `failed / interrupted`. An exception in the driver gives `failed / worker_error`. A history without a done action gives `failed / step_limit_reached`. A done action where the built-in judge marks the task impossible gives `failed / task_impossible`. Done with `success` false gives `partial / agent_reported_incomplete`. Done with `success` true but a negative judge verdict gives `partial / judge_rejected`. Only done with `success` true and a positive or absent verdict is `succeeded`. The backend adds two codes the worker cannot report itself: `task_timeout` and `worker_crashed`.

The judge stays enabled because it is the only evidence beyond the model's own claim, at the cost of one extra model call per task. A disagreement between the run and the judge gives `partial`, never a silent success: neither claim is proven, so the user must look.

Every outcome other than `succeeded` carries a reason text of at most 500 characters, cut at a word boundary. The result also carries the final page address and an `offTarget` flag. Hosts are compared in lower case, without a leading `www.` and ignoring ports and paths, so a redirect from `example.com` to `www.example.com` is not a different site. A public suffix list was rejected as an unnecessary data dependency.

## Time limit and graceful stop

The limit scales with the step count: 30 seconds per step, with a minimum of 3 minutes for browser start, the first page load and the final review. With the defaults, 1 step allows 3 minutes, 20 steps 10 minutes, 100 steps 50 minutes. All three values are configurable. When the limit hits, the backend sends SIGTERM, the worker cancels the driver and still encodes its frames in a `finally` block, and the backend waits up to 30 seconds before SIGKILL. Killing at once was rejected because the recording of a stalled run shows where it stalled. A worker that emitted a result line always exits 0. A worker that exits without one becomes `worker_crashed`, with the exit code in the reason and no stderr content. When a result line and the time limit race, the first event wins.

## Result view

One finished view serves all outcomes. The three outcomes differ in label, colour and icon, so colour is never the only signal. The reason renders as plain text, and the final address renders as a link only for `http` and `https`, opening in a new tab without a referrer. When the final host differs from the target host, a warning names both. Every artifact is shown and downloadable for every outcome. "Edit and retry" reopens the form with prompt, target, format, quality and step limit.

## Risks and acceptance

The judge can be wrong both ways. A rejected good run shows as partial with the recording available, which is the right prompt to watch it. An accepted wrong run on the right host passes; the final address and off-target warning are independent evidence but cannot catch a wrong page on the right host without an expected result from the user. A slow model can hit the limit on a healthy long task; the recording up to the stop is kept and the limit can be raised. A SIGTERM may leave the model subprocess alive for up to its own 120 second timeout.

Acceptance: every finished task has exactly one outcome; a run that uses all steps is `failed / step_limit_reached`; non-success outcomes always explain themselves; the off-target warning names both hosts; the recording of a timed-out run is available. A fake worker scenario covers each outcome, including hang, hard hang and crash. A cancel button, an expected-result field and persistence across backend restarts are out of scope.
