#!/usr/bin/env node
/**
 * The world half, fetched with Gemini.
 *
 * This is the only part of a brief that talks to a third party, and it is the
 * only part that may: it reads public news against a list of things you are
 * working on. The other two sections come out of your Nib notes and your Tend
 * store, which contain assessments of named colleagues, and those stay with
 * Claude. That line is a privacy decision about other people, not a cost
 * optimisation - see DECISIONS.md, and do not move it to save quota.
 *
 * Why Gemini for this half at all: reading a lot of source text is the cheap,
 * high-volume part, and its free tier covers a brief a day many times over.
 * Judgement - needs-you versus worth-knowing - is the expensive part and stays
 * where the rest of the reasoning is.
 *
 * Output is `world.json`, NOT `brief.json`. What comes back is a candidate
 * pool: unsorted, unjudged, in whatever language the sources were in. The
 * session assembling the brief does the sorting and writes the prose.
 *
 * What it searches for is NOT your whole board. Brief derives what you are
 * holding by reading Jot, but that list carries internal project codenames and,
 * on the private side, things nobody would choose to post to a search API.
 * Sending it was the first design and it was a privacy bug. `outbound.json` is
 * the opt-in list; without one, this refuses.
 *
 *   node scripts/fetch-world.mjs --review  draft outbound.json, everything off
 *   node scripts/fetch-world.mjs --dry     print exactly what would be sent
 *   GEMINI_API_KEY=... node scripts/fetch-world.mjs
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { noKeyMessage, readKey } from '../src/domain/key.js';
import { requireDataDir, resolveJotDir } from '../src/domain/paths.js';
import { holdings } from '../src/service/holdings.js';
import { interestsPath, searchable } from '../src/service/interests.js';
import { draftOutbound, outboundPath, sendable } from '../src/service/outbound.js';

const HOST = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

const dry = process.argv.includes('--dry');
const review = process.argv.includes('--review');
const dir = requireDataDir();
const jot = resolveJotDir();

if (review) {
  const held = holdings({ dataDir: dir, jotDir: jot.dir });
  const { path, added, total } = draftOutbound(dir, held);
  console.log(`${path}\n${total} items, ${added} new, all new ones switched off.`);
  console.log('\nTick the ones you are happy to send to Google. For anything whose name');
  console.log('gives something away, set "as" to a neutral description instead.');
  process.exit(0);
}

/*
 * Two lists, two jobs.
 *
 * `interests` are what gets searched for - standing topics you wrote down. They
 * are the query, because a board never says "Unity" or "how engineering
 * organisations are run" and those are exactly the things worth watching.
 *
 * `held` are what makes a hit matter to you specifically, and they are a poor
 * query on their own: "Household" is a filing label, and posting those two words
 * to a search engine returns nothing. As context they are excellent - "Roblox
 * changed its payout model" is a topic hit, and "Meteor Run is on your board"
 * is what turns it into something that needs you today.
 */
const wanted = searchable(dir);
const held = sendable(dir);

if (wanted.length === 0) {
  console.error(
    `No interests to search for.\n\n` +
      `Brief searches for standing topics you have written down - Unity, how\n` +
      `engineering organisations are run, whatever you actually watch. It cannot\n` +
      `derive those: your Jot board says what you are working on this week, never\n` +
      `what you care about in general.\n\n` +
      `Add them under "Sending" in the window, or write ${interestsPath(dir)}.\n\n` +
      `The board is still used - as context, to judge what needs you rather than\n` +
      `merely being about the topic. That half is opt-in per item:\n\n` +
      `  node scripts/fetch-world.mjs --review\n\n` +
      `writes ${outboundPath(dir)} with everything switched off.`
  );
  process.exit(1);
}

const wantedText = wanted
  .map((w) => `- ${w.term}${w.why ? `\n    why this person cares: ${w.why}` : ''}`)
  .join('\n');

const heldText =
  held.length === 0
    ? '(nothing - judge relevance from the interests alone)'
    : held.map((h) => `- ${h.label} [${h.kind}]`).join('\n');

/**
 * The grounded call.
 *
 * Deliberately asks for prose rather than JSON, because it cannot have both:
 * the API rejects a responseSchema alongside the google_search tool with
 * "controlled generation is not supported with google_search tool". So this is
 * two calls - search freely, then shape the answer - and that is a constraint of
 * the API, not a preference.
 */
const searchPrompt = `You are assembling the raw material for one person's morning brief. Today is ${new Date().toISOString().slice(0, 10)}.

WHAT TO SEARCH FOR - their standing interests:

${wantedText}

WHAT MAKES A STORY MATTER TO THEM - what they are carrying right now:

${heldText}

Search for news from the last 48 hours on the interests above.

How to judge each story:
- It has to be a concrete change - something published, decided, priced, shipped, regulated, withdrawn. Not an opinion piece, not a think-piece, not a listicle. If the only thing that happened is that somebody wrote about a topic, leave it out.
- Say which interest it answers. If you cannot, it does not belong in the brief.
- If it also touches something they are carrying, say which one - that is what separates a story that needs them from one that is merely about a topic they follow.
- Prefer primary sources - the company, the regulator, the standards body - over coverage of them.
- Between three and twelve stories. Fewer is better than padded. None is a legitimate answer, and saying so is more useful than filling the space.

For each story give: the headline in one plain sentence, two or three sentences on what actually happened, which interest it answers, whether it touches anything they are carrying and how, and the source URL.`;

/** The shaping call. No tools, so a schema is allowed. */
const SCHEMA = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          headline: { type: 'string' },
          summary: { type: 'string' },
          interest: { type: 'string', description: 'Which standing interest this story answers.' },
          anchor: {
            type: 'string',
            description: 'What the person is carrying that this touches, if anything. Empty if nothing.'
          },
          why: { type: 'string', description: 'Why that item makes this matter.' },
          sources: {
            type: 'array',
            items: {
              type: 'object',
              properties: { title: { type: 'string' }, url: { type: 'string' } },
              required: ['url']
            }
          }
        },
        required: ['headline', 'summary', 'interest', 'why']
      }
    }
  },
  required: ['candidates']
};

if (dry) {
  console.log(searchPrompt);
  console.log(
    `\n--- this is the whole request body's text. ` +
      `${wanted.length} interest${wanted.length === 1 ? '' : 's'}, ` +
      `${held.length} cleared item${held.length === 1 ? '' : 's'} of context. ---`
  );
  process.exit(0);
}

const found = readKey(dir);
if (found === null) {
  console.error(noKeyMessage(dir));
  process.exit(1);
}
const key = found.key;
console.log(`Key from ${found.source}.`);

/**
 * @param {string} model
 * @param {Record<string, unknown>} body
 */
async function call(model, body) {
  const response = await fetch(`${HOST}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Gemini returned ${response.status}: ${text.slice(0, 600)}`);
  }
  return JSON.parse(text);
}

/** @param {any} payload */
const firstText = (payload) =>
  (payload?.candidates?.[0]?.content?.parts ?? [])
    .map((/** @type {any} */ part) => part.text ?? '')
    .join('')
    .trim();

console.log(`Searching against ${held.length} things you are holding...`);

const grounded = await call(MODEL, {
  contents: [{ role: 'user', parts: [{ text: searchPrompt }] }],
  tools: [{ google_search: {} }]
});

const prose = firstText(grounded);
if (prose === '') {
  console.error('Gemini returned nothing for the search step.');
  process.exit(1);
}

/*
 * Grounding metadata carries the real source URLs, but as
 * vertexaisearch.cloud.google.com redirect links rather than the publisher's
 * own address. They resolve, and they expire. Both are kept: the redirect
 * because it is what was actually cited, and whatever the model wrote inline
 * because that is the durable one.
 */
const chunks = grounded?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
const cited = chunks
  .map((/** @type {any} */ chunk) => chunk?.web)
  .filter(Boolean)
  .map((/** @type {any} */ web) => ({ title: web.title ?? '', url: web.uri ?? '' }));

console.log('Shaping it...');

const shaped = await call(MODEL, {
  contents: [
    {
      role: 'user',
      parts: [
        {
          text: `Turn the following into structured records. Change nothing and add nothing - no story that is not below, no source that is not below. If a story has no source URL in the text, leave its sources empty rather than inventing one.\n\n${prose}`
        }
      ]
    }
  ],
  generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA }
});

const parsed = JSON.parse(firstText(shaped));

const out = {
  fetchedAt: Date.now(),
  model: MODEL,
  // Kept so a bad batch can be audited: exactly what was searched for, and
  // exactly what context went with it.
  searched: wanted,
  sent: held,
  candidates: parsed.candidates ?? [],
  cited,
  // Kept so a bad batch can be read back and argued with rather than guessed at.
  raw: prose
};

const path = join(dir, 'world.json');
writeFileSync(path, JSON.stringify(out, null, 2), 'utf8');

console.log(`\n${out.candidates.length} candidates -> ${path}`);
console.log('Nothing has been briefed yet. A session reads this, judges it, and writes brief.json.');
