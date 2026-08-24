/**
 * What each half of the morning run is asked to do.
 *
 * Lifted out of the scripts so `plan` and `morning` cannot drift: one prints the
 * assignment for a human to paste, the other hands it to a session, and a brief
 * produced either way should have been asked for the same thing.
 */

import { join } from 'node:path';

import { holdings } from './holdings.js';
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
  "week":    { "summary": "one paragraph", "moments": [{ "id": "...", "when": "Monday", "text": "..." }] },
  "confirm": [{ "id": "...", "kind": "decision|story|delegation|person", "text": "...",
                "why": "...", "evidence": "..." }],
  "notes":   ["anything you want to say about this run"]
}

Caps, enforced whether you respect them or not - over them, the extras are
dropped and the window says so: needsYou 5, worthKnowing 7, moments 6, confirm 5.
Fewer is better. A brief has a bottom; that is the product.

The world section:
- needs-you means something CHANGES for them - a decision to make, a number in a
  plan, a deadline. "Important in general" is worth-knowing at best.
- Do not infer what they do for a living. An interest in a platform is not
  evidence that they ship on it, and a "needs you" that needs somebody else costs
  more trust than a missed story.

The week section: fill it from what actually happened if you can see it. Leave it
empty rather than inventing it.

The confirm section, which is the point of the whole app. Three rules:
- It must be about the reader, not about you. A story bank holds stories its
  owner can tell in the first person. Your own mistakes and reversals belong in a
  CLAUDE.md, not here, however good the lesson.
- A decision already recorded in a repo's DECISIONS.md is not a candidate. A
  second copy is worse than none, because copies drift. What belongs here is the
  decision with nowhere to live.
- Generate from what LACKS a record, not from what was written recently. Recency
  is not the same as needing to be kept.
Read ${join(dataDir, 'confirmed.jsonl')} first: what was rejected before is a
filter, and a suggestion resembling a past rejection should not be made again.

Write the prose in Swedish, keeping å, ä and ö. Write to a temporary file in the
same directory and rename it into place - the window is watching, and a plain
write is visible half-finished.`;
}
