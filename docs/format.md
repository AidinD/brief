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
  "behind": [ { "id": "...", "headline": "...", "why": "...", "anchor": "..." } ],
  "week": {
    "summary": "One paragraph.",
    "moments": [ { "id": "...", "when": "Monday", "text": "..." } ]
  },
  "confirm": [ { "id": "...", "kind": "decision", "text": "...", "why": "...", "evidence": "..." } ],
  "provenance": { "fetch": "claude-haiku-4-5-20251001", "judge": "claude-sonnet-5" },
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
| `kind` | no | One of `decision`, `story`, `delegation`, `person`. Anything else is read as `decision` and reported. In practice write only the first two - the other two are what `behind` is for, and are still parsed so that an older brief still renders. |
| `provenance` | **yes in practice** | Which model produced each half. Absent counts as a failure and the window says so - see below. |

Unknown fields are ignored. Missing sections read as empty. A file that is not
valid JSON leaves the previous brief on screen and warns.

## Limits, which are enforced

| Section | Cap |
| --- | --- |
| `world.needsYou` | 5 |
| `world.worthKnowing` | 7 |
| `behind` | 3 |
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

**`behind` is what you owe, and it carries no buttons.** Commitments past their
interval and people who have gone unspoken to, taken from Tend, which is what
tracks them. It renders as its own section above the world and counts towards the
masthead sentence, because it needs you in exactly the sense that sentence means.

It exists because those items were arriving in `confirm`, where the only two
answers are keep and reject and neither one is true of something you are behind
on: keeping files a status that is stale within the month, and rejecting says it
does not matter, when it does. The cap is three, the tightest in the app.
Everything overdue at once is a backlog, and a backlog on a morning page is what
this app exists not to be. Tend holds the rest and keeps counting.

Same item shape as a world story, deliberately - a headline, why it reaches you,
what it hangs off - because a second shape would only mean a second renderer.

**The confirm section is the point of the whole app.** Candidate decisions worth
logging and candidate stories worth keeping: things with nowhere else to live,
where writing them down is the whole of what needs doing. Few, and specific.

A delegation that wants checking in on and a person who is drifting used to be
listed here too. They are `behind` now, for the reason above - the section can
only offer keep or reject, and neither answers them.

Four rules for it, the first three learned by getting four out of five wrong on
the first real day:

**It must be about the reader, not about you.** Three of those five were the
assistant's own mistakes and reversals - a bug chased from the wrong side, a
typing decision undone. A story bank holds stories its owner can tell in the
first person. "My agent got confused for five hours" answers no question anybody
will ever ask them, however good the lesson is. Put that lesson in `CLAUDE.md`
and leave the brief alone.

**Every candidate must be answerable by keep or reject.** If the honest response
is "yes, and now I have to go and do something", it is work rather than a
candidate, and it belongs in `behind` or in the system that tracks it.

**A decision that already has a home is not a candidate.** This is not only about
repos: a duty in Tend and a task in Jot have homes too, and the copy here cannot
be updated when the original moves. Two of the five were
already in a repo's `DECISIONS.md`, in more detail, with the alternatives that
lost. A second copy is worse than none, because copies drift. What belongs here
is the decision with nowhere to live: an agreement between people, a thing the
team stopped doing, a call someone will ask you to justify a year from now.

**Generate from what lacks a record, not from what was recently written.** The
failure was mechanical: the generator swept the last day's commits and
DECISIONS entries, which is a list of things that by definition already have a
record. Recency is not the same as needing to be kept.

A first run at one useful suggestion in five is survivable. A steady rate of one
in five is a section that costs more attention than it returns, and the
rejections are how you can tell - they are recorded for exactly this.

**Swedish keeps its å, ä and ö.** Write in whatever language the person thinks
in; the file is UTF-8 and the window renders it as-is.

## What happens to answers

Accepting or rejecting a candidate appends a line to `confirmed.jsonl`. The
brief itself is **not** edited - it is the record of what was proposed, and
rewriting it would destroy the only evidence of what the generator suggested.

Rejections are recorded too. A generator whose suggestions are always turned
down has a bad filter, and there is no way to see that from the acceptances.

## The world half

`npm run plan` prints the assignment for the fetch step: the interests to search,
the context to judge against, and the `world.json` shape to write. It calls
nothing itself.

`world.json` is a pool - unsorted, unjudged, in whatever language the sources
were in. It is not a brief. The judge step reads it, decides what needs you
versus what is worth knowing, writes the prose and writes `brief.json`.

`npm run morning` prints both commands with their model flags.

Two things about it are worth knowing before you write a generator:

- The fetch sends **only** the interests and whatever is ticked in
  `outbound.json`. Not your board. See `README.md`.
- Record `provenance`. A brief that does not say which model produced it is
  treated as a failure, not as a pass.

## `provenance`

```json
"provenance": { "fetch": "claude-haiku-4-5-20251001", "judge": "claude-sonnet-5" }
```

The fetch step records itself in `world.json`; the judge step copies that across
and adds its own. The window warns when either is the wrong tier for its job,
and warns when there is nothing recorded at all - a configured model says nothing
about what actually ran.
