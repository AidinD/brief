/**
 * What each half of the morning run is asked to do.
 *
 * Lifted out of the scripts so `plan` and `morning` cannot drift: one prints the
 * assignment for a human to paste, the other hands it to a session, and a brief
 * produced either way should have been asked for the same thing.
 */

import { join } from 'node:path';

// `holdings` is deliberately NOT imported here. This module builds a request
// body, and the privacy line says anything that does must read `sendable()`,
// never `holdings()`. The import sat here unused for a while, twenty-eight lines
// above the request builder, which is a regression waiting for someone in a
// hurry.
import { interestsPath, searchable } from './interests.js';
import { outboundPath, sendable } from './outbound.js';

/**
 * The fetch step: search, and write a candidate pool.
 *
 * Throws rather than returning an empty assignment when there is nothing to
 * search for. A session handed "search for nothing" will invent something to
 * do, which is the one outcome worse than not running.
 *
 * @param {object} where
 * @param {string} where.dataDir
 * @param {string} where.jotDir
 * @returns {string}
 */
export function fetchAssignment({ dataDir, jotDir }) {
  const wanted = searchable(dataDir);
  if (wanted.length === 0) {
    throw new Error(
      `No interests to search for.\n\n` +
        `Brief searches for standing topics you have written down. It cannot derive\n` +
        `those: your Jot board says what you are working on this week, never what you\n` +
        `follow in general.\n\n` +
        `Add them under "Sending" in the window, or write ${interestsPath(dataDir)}.`
    );
  }

  const held = sendable(dataDir);
  const wantedText = wanted
    .map((w) => `- ${w.term}${w.why ? `\n    why this person cares: ${w.why}` : ''}`)
    .join('\n');
  const heldText =
    held.length === 0
      ? '(nothing cleared - judge relevance from the interests alone, and do not assume\n a role or a responsibility that is not listed)'
      : held.map((h) => `- ${h.label} [${h.kind}]`).join('\n');

  return `Assemble the raw material for one person's morning brief. Today is ${new Date().toISOString().slice(0, 10)}.

WHAT TO SEARCH FOR - their standing interests:

${wantedText}

WHAT MAKES A STORY MATTER TO THEM - what they are carrying right now:

${heldText}

Search the last 48 hours on the interests above, then write ${join(dataDir, 'world.json')}.

How to judge each story:
- It has to be a concrete change - published, decided, priced, shipped, regulated, withdrawn. Not an opinion piece, not a think-piece. If the only thing that happened is that somebody wrote about a topic, leave it out.
- Say which interest it answers. If you cannot, it does not belong.
- If it also touches something they are carrying, say which one and how.
- Do NOT infer what they do for a living. A story about publishing to a platform only matters if publishing is on the list above; an interest in a platform is not evidence that they ship on it. Getting this wrong produces a "needs you" that needs somebody else, which costs more trust than a missed story.
- Prefer primary sources over coverage of them.
- Three to twelve stories. Fewer is better than padded, and none is a legitimate answer.

Standing gauges and market levels, where an interest asks for one:
- A gauge that an interest asks for by name is reported EVERY day, whatever it
  reads. "Normal" is an answer. This is the one exception to the 48-hour rule
  above: a reading is a state, not an event, and a rule written for events would
  drop it on every ordinary day.
- A market level is a story only when it is genuinely notable, on the terms the
  interest sets - a multi-month extreme, or a large move over a stated window.
  Ordinary daily noise is not a story.
- Report the NUMBER: the value, its unit or currency, the window, and what it is
  being compared against. "Gold 2,480 USD, highest close since April 2024" is a
  fact. "Gold is rallying" is not.
- Cite whoever publishes the figure, not somebody commenting on it.
- Never include a forecast, a price target, an analyst rating, a buy or sell
  recommendation, or any sentence about where something is heading. If the only
  content is somebody's opinion about a direction, it is not a story.
- A geopolitical event that touches energy or commodities belongs here as the
  EVENT - what was decided or what happened, and where. Never pair it with a
  conclusion about what it does to a price; that inference is the reader's.
- These are always "worth knowing", never "needs you". A number asks for
  judgement, not for action today, and a market figure in the needs-you column
  would be the app telling somebody to trade.

world.json:
{
  "fetchedAt": <epoch ms>,
  "provenance": { "fetch": "<the model id you are>" },
  "searched": <the interests above, verbatim>,
  "candidates": [
    { "headline": "...", "summary": "...", "interest": "...", "anchor": "...", "why": "...",
      "sources": [{ "title": "...", "url": "https://..." }] }
  ]
}

Write world.json and stop. Do not write brief.json - judging and the prose are a
separate step on a different model.

Nothing outside the two lists above may be sent to a search engine. The board is
not the filter; ${outboundPath(dataDir)} is.`;
}

/**
 * The judge step: read the pool, decide, write the brief.
 *
 * Deliberately self-contained. An earlier version told the session to go and
 * read `docs/format.md`, which fails in the packaged app twice over: `docs/` is
 * not shipped, and a spawned process cannot read inside an asar archive even
 * when it is. An instruction that depends on a file the runner might not be able
 * to open is an instruction that silently becomes something else.
 *
 * @param {object} where
 * @param {string} where.dataDir
 * @returns {string}
 */
export function judgeAssignment({ dataDir }) {
  return `Read ${join(dataDir, 'world.json')} and write ${join(dataDir, 'brief.json')}.

Shape:
{
  "version": 1,
  "date": "<today, YYYY-MM-DD, LOCAL date>",
  "generatedAt": <epoch ms>,
  "provenance": { "fetch": "<copy from world.json>", "judge": "<the model id you are>" },
  "world": {
    "needsYou":     [{ "id": "...", "headline": "...", "why": "...", "anchor": "...",
                       "sources": [{ "title": "...", "url": "https://..." }] }],
    "worthKnowing": [ ...same shape... ]
  },
  "behind":  [{ "id": "...", "headline": "...", "why": "...", "anchor": "..." }],
  "week":    { "summary": "one paragraph", "moments": [{ "id": "...", "when": "Monday", "text": "..." }] },
  "confirm": [{ "id": "...", "kind": "decision|story|delegation|person", "text": "...",
                "why": "...", "evidence": "..." }],
  "notes":   ["anything you want to say about this run"]
}

Caps, enforced whether you respect them or not - over them, the extras are
dropped and the window says so: needsYou 5, worthKnowing 7, behind 3, moments 6,
confirm 5. Fewer is better. A brief has a bottom; that is the product.

The world section:
- needs-you means something CHANGES for them - a decision to make, a number in a
  plan, a deadline. "Important in general" is worth-knowing at best.
- Do not infer what they do for a living. An interest in a platform is not
  evidence that they ship on it, and a "needs you" that needs somebody else costs
  more trust than a missed story.

The behind section, which is where an overdue commitment goes:
- A duty past its interval, or a person who has gone unspoken to, belongs HERE
  and never in confirm. Confirm offers two answers, keep and reject, and neither
  one is true of something you are behind on: keeping it files a status that is
  stale within the month, and rejecting it says it does not matter when it does.
- Take these from Tend, which is what tracks them. Say what is overdue, by how
  much, and against what target. Anchor each one to the duty it belongs to.
- At most three, and if more than three are overdue write ONE item that says how
  many and points at Tend. Everything you are behind on, listed, is a backlog,
  and a backlog on a morning page is the thing this app exists not to be.
- Never put a world story here, however urgent. This section is what you owe.

The week section: fill it from what actually happened if you can see it. Leave it
empty rather than inventing it.

The confirm section, which is the point of the whole app. Three rules:
- It must be about the reader, not about you. A story bank holds stories its
  owner can tell in the first person. Your own mistakes and reversals belong in a
  CLAUDE.md, not here, however good the lesson.
- Anything a system already holds and keeps holding is not a candidate. A repo's
  DECISIONS.md is the obvious case, but so is a duty in Tend and a task in Jot: a
  second copy is worse than none, because copies drift, and the copy here cannot
  be updated when the original moves. What belongs here is the thing with nowhere
  to live.
- Every candidate must be ANSWERABLE by keep or reject. If the honest response is
  "yes, and now I have to go and do something", it is work, not a candidate, and
  it belongs in behind or in the system that tracks it.
- Generate from what LACKS a record, not from what was written recently. Recency
  is not the same as needing to be kept.
Read ${join(dataDir, 'confirmed.jsonl')} first: what was rejected before is a
filter, and a suggestion resembling a past rejection should not be made again.

Write the prose in Swedish, keeping å, ä and ö. Write to a temporary file in the
same directory and rename it into place - the window is watching, and a plain
write is visible half-finished.`;
}
