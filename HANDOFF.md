# Handoff - latest session state

_Overwritten on each handoff (latest-only); prior handoffs are in git history._
_Saved 2026-08-31 08:20. For durable rationale see DECISIONS.md; for the roadmap, PLAN.md._

Brief (`D:\Repo\Tools\brief`) — handoff for a new session.

## Current state
Working tree is clean, all work is committed and pushed to `main` (latest commit `f71e3ae`), and v0.1.27 is published on GitHub as Latest. 103 unit tests and 37 app-level (`npm run test:app`) checks pass; typecheck is clean.

This window's four requests are all complete:
1. Fixed a false-positive staleness warning for date-titled source revisions (`titleNamesTheDate` in `src/domain/brief.js`).
2. Added a `behind` section (cap 3) so overdue Tend duties stop landing in `confirm`, which can only answer keep/reject.
3. Added a `lesson` field — one daily principle quoted verbatim from a Nib library, rendered last on the page.
4. Grew that Nib library from 13 to 25 principles, including a new private "Practice" category and a Manager's Path delegation-framework note, and fixed a self-inflicted rotation bug (30-day no-repeat would have gone silent once the library shrank below 30 entries — now falls back to least-recently-seen).

Read `DECISIONS.md` (three newest entries) and `docs/format.md` for the durable record of what changed and why — not duplicated here.

## Key decisions worth knowing going in
- The `behind` section deliberately reuses the world-item shape (headline/why/anchor) rather than inventing a second renderer, and carries no buttons — see `docs/format.md` §"behind".
- The lesson lives in **Brief**, not Tend, because Brief is the only surface read daily without being sought (Tend's recall is prompted, via `tend_prep`).
- Library principles are copied **verbatim** (title + opening sentence), never paraphrased — recognizability is the whole value.
- Manager's Path notes that summarize rather than quote say so explicitly in a footer ("sammanfattad snarare än citerad") rather than presenting a possibly-misremembered framework as a direct quote.
- `judgeAssignment()` in `src/service/assignment.js` now takes `{ dataDir, nibDir }` and is the single source of truth for the judge prompt's rules (behind, confirm-answerability, lesson-verbatim, no-rebuke, rotation fallback) — all asserted against in `test/assignment.test.mjs`.

## Loose end, not acted on
`src/service/keep.js` still has a stale comment claiming Nib's data directory is unreachable `userData`. `NIB_DATA_DIR` now correctly points at `D:\Dropbox\nib`. Noted to the user but not fixed — worth a quick comment cleanup if picked up.

## User's own pending actions (not mine to do)
- Re-pin six repos on their GitHub profile (helm, claude-code-skills, tend, ai-property-scout, keel, jot) — no API for pins.
- One manual PomPom reinstall (appId changed to `io.github.aidind.pompom`).

## Next steps
None queued. The user's last request is fully shipped. Do not start new work without the user asking — this handoff exists so a fresh session has context, not a to-do list.
