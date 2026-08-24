#!/usr/bin/env node
/**
 * Print the morning's assignment, for the session that writes the brief.
 *
 * This used to call Gemini. It does not call anything now, and that is a
 * simplification rather than a retreat.
 *
 * The reason for Gemini was that reading a lot of source text is the cheap,
 * high-volume half and its free tier would cover it. That premise held for
 * everything except the one capability that mattered: **search grounding on the
 * Gemini API is paid-tier only** - $35 per 1000 grounded prompts, free in AI
 * Studio's web interface and not through the API. Plain calls returned 200 and
 * every grounded call returned 429, on four different models. Without grounding
 * a model answers about the last two days from training data, which is worse
 * than nothing because it is confidently stale.
 *
 * And the thing that writes the brief is a Claude session anyway. It can search.
 * So there is one vendor, no key, no billing, and nothing leaves for a third
 * party that was not already going to a search engine.
 *
 *   node scripts/plan.mjs            print the assignment
 *   node scripts/plan.mjs --review   draft outbound.json, everything switched off
 *   node scripts/plan.mjs --command  print the scheduled command, with models
 */

import { join } from 'node:path';

import { requireDataDir, resolveJotDir } from '../src/domain/paths.js';
import { MODELS } from '../src/domain/models.js';
import { holdings } from '../src/service/holdings.js';
import { interestsPath, searchable } from '../src/service/interests.js';
import { draftOutbound, outboundPath, sendable } from '../src/service/outbound.js';

const review = process.argv.includes('--review');
const command = process.argv.includes('--command');
const dir = requireDataDir();
const jot = resolveJotDir();

if (review) {
  const held = holdings({ dataDir: dir, jotDir: jot.dir });
  const { path, added, total } = draftOutbound(dir, held);
  console.log(`${path}\n${total} items, ${added} new, all new ones switched off.`);
  console.log('\nTick what may be searched for. Interests are the search terms;');
  console.log('these are context, and a category name is a filing label.');
  process.exit(0);
}

if (command) {
  // Two sessions, not one, so the cheap half cannot quietly run on the
  // expensive model. The model is passed explicitly and recorded in the output.
  console.log(`# The morning run. Two steps, two models, on purpose.\n`);
  console.log(`# 1. Read the web. Volume work.`);
  console.log(`#    ${MODELS.fetch.why}`);
  console.log(`claude --model ${MODELS.fetch.id} -p "$(node scripts/plan.mjs)"\n`);
  console.log(`# 2. Judge and write. This is the product.`);
  console.log(`#    ${MODELS.judge.why}`);
  console.log(`claude --model ${MODELS.judge.id} -p "Read ${join(dir, 'world.json')}, judge`);
  console.log(`  each candidate as needs-you or worth-knowing, write the prose in Swedish,`);
  console.log(`  and write ${join(dir, 'brief.json')} per docs/format.md. Record`);
  console.log(`  provenance.fetch from world.json and provenance.judge as the model you are.`);
  console.log(`  For the confirm section, read the three rules in docs/format.md first: it`);
  console.log(`  must be about the reader and not about you, a decision already in a repo's`);
  console.log(`  DECISIONS.md is not a candidate, and generate from what lacks a record`);
  console.log(`  rather than from what was written recently. Check`);
  console.log(`  ${join(dir, 'confirmed.jsonl')} - what was rejected before is a filter."\n`);
  console.log(`# Whether that worked is checked on the brief, not on this command:`);
  console.log(`# brief.json carries provenance, and the window says so if it disagrees.`);
  process.exit(0);
}

const wanted = searchable(dir);
const held = sendable(dir);

if (wanted.length === 0) {
  console.error(
    `No interests to search for.\n\n` +
      `Brief searches for standing topics you have written down. It cannot derive\n` +
      `those: your Jot board says what you are working on this week, never what you\n` +
      `follow in general.\n\n` +
      `Add them under "Sending" in the window, or write ${interestsPath(dir)}.`
  );
  process.exit(1);
}

const wantedText = wanted
  .map((w) => `- ${w.term}${w.why ? `\n    why this person cares: ${w.why}` : ''}`)
  .join('\n');

const heldText =
  held.length === 0
    ? '(nothing cleared - judge relevance from the interests alone, and do not assume\n a role or a responsibility that is not listed)'
    : held.map((h) => `- ${h.label} [${h.kind}]`).join('\n');

console.log(`Assemble the raw material for one person's morning brief. Today is ${new Date().toISOString().slice(0, 10)}.

WHAT TO SEARCH FOR - their standing interests:

${wantedText}

WHAT MAKES A STORY MATTER TO THEM - what they are carrying right now:

${heldText}

Search the last 48 hours on the interests above, then write ${join(dir, 'world.json')}.

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
separate step on a different model.`);
