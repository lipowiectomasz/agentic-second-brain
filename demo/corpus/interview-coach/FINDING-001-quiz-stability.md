# Quiz Stability Findings

## Symptoms

Several problems surfaced in the quiz workflow of the interview training app:

- Quiz creation could take tens of seconds behind a static "preparing" label, and the user could not tell expected latency from a stalled request. A failure also lost the form state.
- Hybrid audio mode behaved exactly like Silent, because the quiz page only branched for Full voice. Full voice started listening even after a failed speech attempt and reported every failure through one generic error channel.
- Every transcription request failed with HTTP 502.
- Printed reports showed light text on a white page, and long result cards produced an almost empty first page.

## Root causes and fixes

**Transcription.** The local speech-to-text image installed floating Python dependencies. `faster-whisper` 1.2.1 calls `av.open(..., metadata_errors="ignore")`, and PyAV 19 removed that argument. The fix pins the direct dependencies exactly, including `faster-whisper==1.2.1` and `av==18.1.0`. PyAV must not go above 18 until a faster-whisper release stops passing that argument. A post-start smoke test posts a short in-memory WAV and checks the response without printing the transcript. Note the contract difference: the speech service returns a `text` field, while the app's own proxy returns `transcript`. Both paths were verified against running services.

**Audio state.** `speakQuestion` now returns the speech result, and listening starts only after speech succeeds. The legacy `onError(message: string)` callback was kept for interviews; quizzes use new separate callbacks for speech, microphone and transcription errors. A failure stops the automatic sequence and shows `Retry voice` for the current question only, while manual answer controls stay enabled. Hybrid now offers `Read question aloud` and `Replay question`, never requests the microphone and never transcribes.

**Late responses.** Guards ignore speech and transcription results that arrive after the user has moved on. A cancelled server speech request no longer falls through to browser speech, and submitting an answer manually stops active audio. A review also caught a late rejection from `play()` and an event from the previous recorder; both were fixed. Without the cancellation changes, a retry could stop the new operation or replay the previous voice.

**Quiz creation.** The page shows an elapsed `m:ss` timer in an ARIA live region and keeps topic, level, format, count and review focus after a failure, with a `Try Again` action. The timer shows waiting time honestly; it does not make generation faster and adds no polling.

**Printing.** The print block forces a light colour scheme, dark text and printable borders, and hides screen-only actions with a `print-hidden` class. `break-inside: avoid-page` on a whole long card created the nearly empty first page in Chromium, so cards now split automatically while headings stay with their content and widows and orphans are limited. Flex layout and animations are disabled for print.

## Verification

Final results: 16 shared, 120 backend and 42 frontend tests passed, the type check passed for all packages, and all production images built. The last frontend bundle was 342 kB with no size-limit warning. Browser tests used locally intercepted data instead of stored trainings, and the full voice loop was exercised with a synthetic audio stream rather than a physical microphone.
