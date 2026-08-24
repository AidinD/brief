#!/usr/bin/env node
/**
 * Run the morning: fetch, then judge, then stop.
 *
 * Two sessions on two models, because the fetch is volume work and the judgement
 * is the product - and because a single session inherits whatever model it was
 * launched with, which is how the expensive mistake happens by accident.
 *
 * ## The guard is here, not in the scheduler
 *
 * This is meant to run from Task Scheduler with two triggers: a daily time, and
 * again at logon so a machine that was switched off at 07:00 still gets a brief.
 * Two triggers means it can fire twice, and "run once a day" is not something a
 * scheduler can promise across a reboot.
 *
 * So the promise is made here: **if today's brief already exists, this does
 * nothing and says so.** Idempotence in the script survives anything the
 * scheduler does, including being run by hand out of curiosity while the
 * scheduled one is already going.
 *
 *   node scripts/morning.mjs             fetch and judge, unless today is done
 *   node scripts/morning.mjs --force     do it anyway, replacing today's brief
 *   node scripts/morning.mjs --command   print the two commands, run nothing
 */

import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MODELS } from '../src/domain/models.js';
import { requireDataDir, resolveJotDir } from '../src/domain/paths.js';
import { localDate } from '../src/domain/time.js';
import { fetchAssignment, judgeAssignment } from '../src/service/assignment.js';
import { openStore } from '../src/storage/store.js';

const repoDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const force = process.argv.includes('--force');
const commandOnly = process.argv.includes('--command');

const dir = requireDataDir();
const jot = resolveJotDir();
const now = Date.now();
const today = localDate(now);

/**
 * Everything this run says goes to a file as well as stdout.
 *
 * Scheduled tasks have no console. Without a log, a morning with no brief is
 * indistinguishable from a morning with no news - and those need very different
 * responses.
 *
 * @param {string} message
 */
function log(message) {
  const line = `${new Date(now).toISOString()}  ${message}`;
  console.log(message);
  try {
    appendFileSync(join(dir, 'morning.log'), `${line}\n`, 'utf8');
  } catch {
    // A missing log is not a reason to skip the brief.
  }
}

if (commandOnly) {
  console.log('# What this script runs. Two models, on purpose.\n');
  console.log(`# 1. ${MODELS.fetch.why}`);
  console.log(`claude --model ${MODELS.fetch.id} -p "<the assignment from npm run plan>"\n`);
  console.log(`# 2. ${MODELS.judge.why}`);
  console.log(`claude --model ${MODELS.judge.id} -p "<judge world.json, write brief.json>"\n`);
  console.log('# Run them together, with the once-a-day guard:');
  console.log('node scripts/morning.mjs');
  process.exit(0);
}

/* --------------------------------------------------- the once-a-day guard -- */

const store = openStore({ dataDir: dir });
const existing = store.read(today, now);

if (!existing.missing && existing.brief.date === today && !force) {
  log(`Today's brief already exists (${today}). Nothing to do.`);
  process.exit(0);
}

/* ------------------------------------------------------------------- run -- */

/**
 * @param {string} label
 * @param {string} model
 * @param {string} prompt
 */
function session(label, model, prompt) {
  log(`${label}: starting on ${model}`);
  try {
    // The prompt goes as one argument rather than through a shell, so nothing in
    // it has to be quoted or escaped. Assignments contain newlines and quotes.
    execFileSync('claude', ['--model', model, '-p', prompt], {
      cwd: repoDir,
      stdio: ['ignore', 'inherit', 'inherit'],
      timeout: 15 * 60 * 1000
    });
    log(`${label}: finished`);
    return true;
  } catch (err) {
    log(`${label}: FAILED - ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

let assignment;
try {
  assignment = fetchAssignment({ dataDir: dir, jotDir: jot.dir });
} catch (err) {
  log(`Nothing to search for: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

if (!session('fetch', MODELS.fetch.id, assignment)) {
  process.exit(1);
}

// Checked rather than assumed. A session can exit 0 having written nothing, and
// handing the judge a missing file produces a brief invented out of thin air.
const worldPath = join(dir, 'world.json');
if (!existsSync(worldPath)) {
  log(`fetch: exited cleanly but wrote no ${worldPath}. Stopping rather than letting the judge invent one.`);
  process.exit(1);
}

if (!session('judge', MODELS.judge.id, judgeAssignment({ dataDir: dir, repoDir }))) {
  process.exit(1);
}

const after = openStore({ dataDir: dir }).read(today, now);
if (after.missing) {
  log('judge: exited cleanly but there is still no brief for today.');
  process.exit(1);
}

log(
  `Done. ${after.brief.world.needsYou.length} need you, ` +
    `${after.brief.world.worthKnowing.length} worth knowing, ${after.brief.confirm.length} to confirm.`
);
