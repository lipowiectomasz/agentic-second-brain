# Training Catalog Expansion

## Problem

The interview training app offered conversational technical sessions for JavaScript, TypeScript, React, Node.js, Frontend Architecture and a Mixed Technical profile. Candidates preparing for web-development interviews could not practise browser fundamentals, testing strategy, relational databases, API security or application delivery as focused sessions.

Adding options to the form alone would not have worked. The backend validator would reject the new values, the language model would get no topic-specific guidance, and History would show raw slugs instead of readable names. The topic list was also duplicated between the Zod enum, the frontend form, the backend prompt profiles and the tests, so extending each list by hand made silent drift likely.

## Decision

Five standalone topics were added, each selectable on its own and supporting junior, mid and senior levels with 1 to 20 planned questions:

- `web-platform-fundamentals` - semantic HTML, CSS layout, responsive design, rendering, networking basics, accessibility.
- `software-testing` - test levels, boundary cases, isolation, dependency replacement, asynchronous tests.
- `relational-databases` - modelling, SQL, indexes, transactions, migrations, performance analysis.
- `api-design-security` - HTTP design, error contracts, authentication, authorization, validation, rate limiting.
- `application-delivery` - environments, containers, CI quality gates, deployment, rollback, monitoring.

Topic identifiers and English labels now live once in the shared package (`TOPIC_IDS`, `TOPIC_LABELS`, `TOPIC_OPTIONS`), and `TopicSchema = z.enum(TOPIC_IDS)` stays the API boundary that rejects any other string. The detailed prompt profiles stay backend-only: shipping them to the browser would expose internal prompt content and grow the bundle. The backend map is typed `satisfies Record<Topic, string>`, so TypeScript compilation fails if a valid topic has no profile. Each profile carries its label, explicit focus areas, a question style (explanations, scenarios, trade-offs, debugging) and level expectations, from definitions and safe defaults for junior up to failure modes and operational ownership for senior.

The New Session form renders `TOPIC_OPTIONS` instead of hardcoded `<option>` elements. A small `getTopicLabel(topic: string | null)` adapter validates with `TopicSchema.safeParse`, returns "Non-technical" for `null` and falls back to the original string for an unknown historical value, so old rows never disappear from History.

## Alternatives rejected

- Keeping hardcoded options in the form: duplicates the schema and drifts again.
- Storing the catalog in SQLite: adds CRUD, a migration and administration with no need for runtime editing.
- Folding the new areas into Mixed Technical: fails the requirement that each area be independently selectable.

No database migration was needed because `sessions.topic` is already a nullable `TEXT` column, and existing scoring, feedback, history and progress pipelines are reused unchanged.

## Risks and outcome

The main risk was contract drift: a topic accepted by the schema but missing a prompt profile. It is covered by the exhaustive record, parameterized profile tests and the workspace typecheck; prompt wording quality still needs human review. Because the model is nondeterministic, a short session may not touch every focus area of a broad topic. Frontend and backend must be deployed together, since an older backend answers HTTP 400 to a new topic sent by a newer frontend.

The feature shipped with 155 passing tests, a clean workspace TypeScript check and all container images building.
