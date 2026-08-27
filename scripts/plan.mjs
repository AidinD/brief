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
 *   node scripts/plan.mjs            print the assignment the fetch step is given
 *   node scripts/plan.mjs --judge    print the second half, which writes the brief
 *   node scripts/plan.mjs --review   draft outbound.json, everything switched off
 *
 * `npm run morning` is what actually runs it, once a day.
 */

import { requireDataDir, resolveJotDir, resolveNibDir } from '../src/domain/paths.js';
import { fetchAssignment, judgeAssignment } from '../src/service/assignment.js';
import { holdings } from '../src/service/holdings.js';
import { draftOutbound } from '../src/service/outbound.js';

const review = process.argv.includes('--review');
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

// The judge half is worth being able to read on its own. It is the half that
// decides, and it is the one nobody sees until a brief comes out wrong.
if (process.argv.includes('--judge')) {
  console.log(judgeAssignment({ dataDir: dir, nibDir: resolveNibDir().dir }));
  process.exit(0);
}

try {
  console.log(fetchAssignment({ dataDir: dir, jotDir: jot.dir }));
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
