# Knowledge Quiz Mode

## Problem

The interview training app supported conversational technical and recruiter interviews, but interview practice gives no quick recall checks, explicit answer keys, partial credit or targeted repetition. Extending the existing `turns` model would have mixed incompatible response shapes and risked sending correct answers to the browser. Quizzes therefore got their own domain and persistence boundary while reusing the topic catalog from Training Catalog Expansion and the existing language model execution layer.

## Behaviour

A learner picks one topic, a level, a format (`closed`, `open` or `mixed`) and 1 to 20 questions.

- Closed questions have exactly four labelled choices and state whether one or several answers are expected. Selections are compared as sets, so incomplete or excessive selections are not fully correct.
- Open questions are graded by the language model as `correct`, `partial` or `incorrect`, with covered and missing concepts, an expected answer and an explanation. Answers are capped at 2,000 characters.
- Mixed quizzes contain both question types. A one-question mixed quiz picks one type at random to keep the requested count.
- Questions are answered in order and once only; a repeated or invalid submission does not change state.
- Completion stores category counts, percentages and a deduplicated list of concepts to review. A retry copies topic and level and focuses generation on the weak concepts, while the learner can change format and count.
- An interrupted attempt is saved as abandoned, without a fabricated score, and can be resumed later.

## Design decisions

- Answer keys, expected answers, explanations and grading details are kept server-side and concealed from learner responses until the quiz reaches `completed`. Results are revealed after completion so feedback cannot influence later answers.
- Closed-question partial credit is (correct selections - incorrect selections) / correct answers, clamped at zero. This rewards knowledge without encouraging extra selections.
- Questions are generated in batches of at most five, each batch validated before the whole quiz is persisted in one transaction. Closed answers are scored deterministically with no model call; an open answer costs one model call.
- Two tables were added: `quizzes` (topic, level, format, lifecycle status, progress, score, review concepts) and `quiz_questions` (ordered content, private answer key, submitted answer, result, partial score, explanation, concept coverage), with indexes on quiz status and question order.
- The API is `POST /api/quizzes`, `GET /api/quizzes`, `GET /api/quizzes/:id`, `POST /api/quizzes/:id/questions/:questionId/answer`, plus `abandon` and `resume` actions.
- History shows one chronological activity list with separate summaries for interviews and quizzes.

Model output is validated before persistence, SQL is parameterized, and prompts, answer keys, answers, paths and raw process errors are never logged.

## Scope limits

Out of scope: question-bank authoring, spaced repetition, reminders, streaks, leaderboards, timers, multiplayer, shared quiz links and any change to interview or recruiter scoring. Existing session APIs, tables and progress views were left untouched, and the feature shipped with contract, API and React tests plus a production build check.
