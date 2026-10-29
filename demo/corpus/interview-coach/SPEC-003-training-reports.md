# Training Reports and Goals

## Goal

Learners wanted printable summaries of their training and a light motivation signal, without adding server state, accounts or cross-device sync. The decision was to derive every metric in the browser from completed interviews and quizzes already returned by the API, and to store only the weekly target locally.

## Metrics

A pure `calculateTrainingMetrics` function runs on the History page after sessions and quizzes load:

- A completed interview awards 50 base points plus 10 points per completed question.
- A completed quiz awards 10 points per answered question plus its score percentage.
- Weekly completion counts finished interviews and completed quizzes since local Monday midnight.
- A streak counts unique local calendar days and may end today or yesterday, so a learner who has not trained yet today keeps the streak.
- The weekly target accepts 1 to 14 and defaults to 3. It is kept in browser storage; an invalid stored value falls back to 3.

Edge cases: unfinished activity is ignored, the progress bar is clamped at 100 percent while the real completion count is still shown, and all day boundaries use local time to match the learner's own day.

## Printing

History, completed interviews and completed quizzes each get a print action that opens the browser print dialog, so saving a PDF stays a local browser operation. The print stylesheet hides navigation and controls, uses a white background and tries to keep summary cards on one page. Later stability work refined these rules for long result cards; see Quiz Stability Findings.

## Privacy and limits

No new data goes to the backend or any external service. Sensitive answers appear in a printout only when the learner prints a view that already shows them. Achievements, badges, leaderboards, reminders, social sharing, server-side goals and backend PDF generation are out of scope. Verification covered unit tests for the metrics, lint, a production build and a manual browser check of weekly-target persistence and a PDF generated from History.
