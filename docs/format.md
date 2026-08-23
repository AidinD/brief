# `brief.json` — the contract

Brief does not fetch anything. Something else writes `brief.json` into the data
directory and the window notices within a fraction of a second. That is the
whole integration: a file, and a watcher. No server, no port, nothing to
authenticate against.

This document is what a generator has to produce. `scripts/write-sample.mjs`
writes a valid one you can read alongside it.

## Where

`brief.json` in the data directory: `BRIEF_DATA_DIR` if it is set, otherwise
Electron's userData folder. `npm run dev` prints the resolved path at startup,
and the app's own empty state shows it.

Write to a temporary file in the same directory and rename it into place. The
window is watching, and a plain write is visible half-finished.

## Shape

```json
{
  "version": 1,
  "date": "2026-08-24",
  "generatedAt": 1787512345678,
  "world": {
    "needsYou": [ { "id": "...", "headline": "...", "why": "...", "anchor": "...", "sources": [ { "title": "...", "url": "https://..." } ] } ],
    "worthKnowing": [ "...same shape..." ]
  },
  "week": {
    "summary": "One paragraph.",
    "moments": [ { "id": "...", "when": "Monday", "text": "..." } ]
  },
  "confirm": [ { "id": "...", "kind": "decision", "text": "...", "why": "...", "evidence": "..." } ],
  "notes": ["Anything the generator wants to say about itself."]
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `date` | yes | `YYYY-MM-DD`, **local** date. A brief whose date is not today is shown with a warning across the top. |
| `id` | no | Generated if absent, but supply stable ones: the confirm section remembers answers by id, and an id that changes between runs asks the same question twice. |
| `headline` | yes | One plain sentence. An item without one is dropped rather than rendered blank. |
| `why` | no | Why it reaches *this* person. This is the part that is worth writing well. |
| `anchor` | no | What it attaches to: a Jot category, a duty, a person. Rendered as a small tag. |
| `sources` | no | A source with no `url` is dropped; a link that goes nowhere is worse than no link. Only `http` and `https` open. |
| `kind` | no | One of `decision`, `story`, `delegation`, `person`. Anything else is read as `decision` and reported. |

Unknown fields are ignored. Missing sections read as empty. A file that is not
valid JSON leaves the previous brief on screen and warns.

## Limits, which are enforced

| Section | Cap |
| --- | --- |
| `world.needsYou` | 5 |
| `world.worthKnowing` | 7 |
| `week.moments` | 6 |
| `confirm` | 5 |

Over the cap, the extras are **dropped and the drop is shown**. This is not a
rendering nicety. A brief has a bottom - that is the product - and a generator
that keeps overflowing has a filter problem, not a length problem. Hiding the
overflow would hide the only signal that says so.

`confirm` is the tightest for the same reason it is the most valuable: it turns
remembering into reviewing, and a queue of thirty mediocre suggestions is worse
than no queue, because people learn to clear it without reading.

## Writing a good one

**`needsYou` means something changes for them.** A decision they now have to
make, a number in a plan, a deadline, a competitor doing the thing they were
about to do. "Important in general" is `worthKnowing` at best.

**Name the anchor or leave the item out.** If you cannot say which piece of
their work a story touches, it is a topic match, and topic matches are what
makes a filter useless.

**The confirm section is the point of the whole app.** Candidate decisions worth
logging, candidate stories worth keeping, delegations that want checking in on,
people who are drifting. Few, and specific.

**Swedish keeps its å, ä and ö.** Write in whatever language the person thinks
in; the file is UTF-8 and the window renders it as-is.

## What happens to answers

Accepting or rejecting a candidate appends a line to `confirmed.jsonl`. The
brief itself is **not** edited - it is the record of what was proposed, and
rewriting it would destroy the only evidence of what the generator suggested.

Rejections are recorded too. A generator whose suggestions are always turned
down has a bad filter, and there is no way to see that from the acceptances.

## The world half, if you want Gemini to do it

`npm run world` fetches candidate stories with Gemini and writes `world.json` -
a pool, unsorted and unjudged. It is not a brief. Read it, decide what needs
them versus what is worth knowing, write the prose, and write `brief.json`.

Two things about it are worth knowing before you use it:

- It sends **only** what is in `outbound.json` with `send: true`. Not your
  board. See `README.md`.
- It is two API calls, because Gemini refuses a `responseSchema` alongside the
  `google_search` tool. Search first, shape second.
