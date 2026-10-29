# Public demo on Appwrite Cloud

Status: replaced by "Public demo on a self-hosted instance".

## Goal

Development runs on a self-hosted Appwrite stack. The original plan was to show reviewers a project on Appwrite Cloud, populated by the same commands as local and selected by an environment switch: schema and functions including the CLI gateway, the web app on Appwrite Sites, GitHub sign-in and the demo data.

The migration was not meant as a one-off. It would be repeated after every significant change until submission, so it was designed as a chain of commands: a preflight, idempotent provisioning, site deployment, seed and an automated smoke test, stopping at the first failure. The cloud project would never be edited by hand except for steps the API does not offer, and local configuration would stay untouched by cloud commands.

## Plan

- **Preflight** prints the cloud server version, region, readable plan limits and a probe per required key scope, and compares the server `major.minor` with the local version. A missing scope fails; a version mismatch warns.
- **Provisioning** converges the full schema and every function with no code change, and registers web platforms.
- **Sites deployment** uploads a source archive with only the workspace subset the Next.js app needs, built with server-side rendering on Node 22. The archive builder fails if environment files, local stack configuration or dependencies slip in. A failed build keeps the previous deployment active. A prebuilt standalone bundle was the fallback in case Sites could not build an npm workspace.
- **GitHub OAuth** is configured through the API, with printed manual steps as a fallback; separate OAuth apps for local and cloud, since each app has one callback.
- **Smoke suite** against the public URL: e-mail login, GitHub redirect, search, related thoughts, a role change, and a CLI pull, edit and push through the cloud gateway.
- The health function stays local only, to keep the function count within the free limit.

Hosting the web app outside Appwrite was rejected because it would weaken the "built on Appwrite" story.

## Risks found

- **Database limit.** The free plan allows one database per project, while Cortex uses two (VectorsDB and TablesDB). Whether the two engines count separately was not documented. Options were a paid plan, hackathon credits, or presenting the demo from a self-hosted instance.
- **Transaction limit.** Free transactions allow 100 operations; ingestion caps files at 48 chunks so that replacing a file fits.
- **Embedding allowance.** 1,000,000 tokens per model per month with no overage; above the cap, `createTextEmbeddings` returns 402. A full reseed of the demo corpus needs well under 100,000 tokens, and unchanged files are skipped by hash.
- **Version drift.** Cloud ran Appwrite 2.5.x while the local stack had been generated on 2.6.2, so the local stack was pinned to 2.5.0.
- **Sites and the monorepo.** Building a Next.js app inside an npm workspace on Sites was not documented and needed a spike.

## Outcome

Cloud work was put on hold while development continued locally, and the plan was later replaced by a self-hosted public instance that runs the same stack as development.
