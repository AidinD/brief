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

import { resolveDataDir, resolveJotDir } from '../src/domain/paths.js';
import { holdings } from '../src/service/holdings.js';
import { draftOutbound, outboundPath, sendable } from '../src/service/outbound.js';

const HOST = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

const dry = process.argv.includes('--dry');
const review = process.argv.includes('--review');
const { dir } = resolveDataDir(process.cwd());
const jot = resolveJotDir();

if (review) {
  const held = holdings({ dataDir: dir, jotDir: jot.dir });
  const { path, added, total } = draftOutbound(dir, held);
  console.log(`${path}\n${total} items, ${added} new, all new ones switched off.`);
  console.log('\nTick the ones you are happy to send to Google. For anything whose name');
  console.log('gives something away, set "as" to a neutral description instead.');
  process.exit(0);
}

const held = sendable(dir);

if (held.length === 0) {
  console.error(
    `Nothing is cleared to send.\n\n` +
      `Brief knows what you are holding - it reads your Jot board - but that list is\n` +
      `not safe to post to a search API. It carries internal project names, and on the\n` +
      `private side it carries things like what you are reading and where you have\n` +
      `applied. So the send list is separate and opt-in:\n\n` +
      `  node scripts/fetch-world.mjs --review\n\n` +
      `writes ${outboundPath(dir)} with everything switched off. Tick what you mean.`
  );
  process.exit(1);
}

const heldText = held.map((h) => `- ${h.label} [${h.kind}]`).join('\n');

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

Here is what that person is actually holding right now - the areas they are responsible for and the work in progress on their board:

${heldText}

Search for news from the last 48 hours that touches any of these. Relevance means the story changes something about an item on that list: a decision they now have to make, a number in a plan, a risk, a deadline, a competitor doing the thing they were about to do.

Rules:
- Relevance is against a specific item on the list. If you cannot name which one and why, leave the story out.
- Do not include a story because it is in the same industry, or because it is important in general. "Technology" and "politics" are not on the list; the items above are.
- Prefer primary sources - the regulator, the company, the standards body - over coverage of them.
- Between five and twelve stories. Fewer is fine. None is fine.

For each story give: the headline in one plain sentence, two or three sentences on what actually happened, which item on the list it touches and why that item makes it matter, and the source URL.`;

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
          anchor: { type: 'string', description: 'The item on the holdings list this touches.' },
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
        required: ['headline', 'summary', 'anchor', 'why']
      }
    }
  },
  required: ['candidates']
};

if (dry) {
  console.log(searchPrompt);
  console.log(`\n--- this is the whole request body's text. ${held.length} cleared items. ---`);
  process.exit(0);
}

const key = process.env.GEMINI_API_KEY ?? '';
if (key.trim() === '') {
  console.error(
    'Set GEMINI_API_KEY. It is a free AI Studio key and is NOT the same thing as a\n' +
      'Gemini subscription - a subscription gives no API access at all.\n' +
      'https://aistudio.google.com/apikey'
  );
  process.exit(1);
}

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
