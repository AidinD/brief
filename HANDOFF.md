# Handoff - latest session state

_Overwritten on each handoff (latest-only); prior handoffs are in git history._
_Saved 2026-09-04 20:38. For durable rationale see DECISIONS.md; for the roadmap, PLAN.md._

Handoff — Brief, "one thing to learn" feature, shipped and released

## Current state

Working tree is clean (verify with `git status` before trusting this). All work committed to `main` at `14d9404` and pushed. Released as `v0.1.29` on GitHub — verified not draft, not prerelease, `v0.1.29` tag exists, all three electron-updater assets present (`Brief-Setup-0.1.29.exe`, `.blockmap`, `latest.yml`). 122 unit tests, 42 app e2e checks (`npm run test:app`), and typecheck all pass.

## What was built

A new "one thing to learn" section: a small card (title + 1-2 sentences, sized like the existing `lesson` principle card) sitting directly above the principle at the bottom of the brief, with a "Learn more · N min" button that renders and opens a standalone HTML deep-dive page in the browser. Full rationale, rejected alternatives, and the contract are in `DECISIONS.md` (entry dated 2026-09-03) and `docs/format.md` — read those rather than re-deriving design reasoning here.

Key files touched/added (see the commit `14d9404` for the full diff):
- `src/domain/learn.js` (new) — `Topic`/`Article` parsing, `isTopicId` slug validation, `readingMinutes` (measured, not declared)
- `src/service/article.js` (new) — renders an `Article` to self-contained, fully-escaped HTML (no network deps, no script)
- `src/domain/brief.js`, `src/storage/store.js`, `src/service/api.js`, `src/main/index.js` — wired `learn` into the brief shape, added `store.article()`/`writeArticlePage()`, `api.learnPage()`, and the `openLearn` IPC operation (takes no argument — only today's article can ever be opened)
- `src/renderer/app.js`, `app.css` — the card UI
- `src/service/assignment.js` — judge prompt now asks for the topic + article, with rules: never news, never about the reader's own unreadable repos, never homework, dedup via `learned.jsonl`
- `test/learn.test.mjs` (new), `test/assignment.test.mjs` (extended) — including an XSS-style test that fires a `<script>`/`onerror` at the renderer and asserts it comes out as escaped text only
- `scripts/write-sample.mjs`, `scripts/e2e-app.mjs` — sample data and e2e coverage for the new card
- `CLAUDE.md`, `README.md`, `docs/format.md`, `DECISIONS.md` — documentation

## Key decisions (why, briefly — full detail in DECISIONS.md)

- The app renders the article HTML from generator-written *values* (paragraphs/lists/code blocks), never accepts raw HTML from the generator — both because a model would produce inconsistent markup every day, and because a model-written HTML file opened in a browser is an unescaped-content security risk.
- The article's `id` is validated as a strict slug (`[a-z0-9-]`, checked in `learn.js` and again where the path is built in `store.js`) because it becomes a filename.
- Reading time shown on the button is computed by counting words in the rendered article, never trusted from the generator.
- The card/button is deliberately *not* counted in the "N things need you" tally — it's an offer, not a question.
- Topics can't reference Aidin's own repos (the judge session can't read `D:\Repo`, so it would confabulate) — this was a real limitation flagged to the user, not silently worked around.

## Not yet done / possible next steps

- No real morning run has exercised this yet — the first live judge-generated topic+article will appear on the next scheduled `npm run morning` run. Worth spot-checking that output once it lands (does the judge follow the "no exercise/homework" and "never about the reader's own repos" rules in practice, not just in the prompt).
- User asked whether they'd prefer English-language articles instead of Swedish — currently follows the existing all-Swedish-prose convention. Not changed; flagged as an open option if they want it addressed.
- If "teach me about keel/the suite itself" is ever wanted as a topic, that requires giving the judge session a readable source directory — explicitly deferred as a separate decision, not attempted here.
