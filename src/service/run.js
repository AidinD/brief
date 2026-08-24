/**
 * Running the morning: fetch, then judge, then stop.
 *
 * This lives in `src/` rather than in `scripts/` for one concrete reason: the
 * packaged app ships `src/**` and not `scripts/**`, so a button in the window
 * could not have reached it there. Both callers - the scheduled task and the
 * button - now run exactly the same code, which is the only way they stay
 * honest about each other.
 *
 * ## The once-a-day guard is here
 *
 * The scheduled task has two triggers, a daily time and logon, because a desktop
 * is often switched off at eight in the morning and a missed trigger is
 * otherwise simply missed. Two triggers can fire twice, and "once a day" is not
 * something a scheduler can promise across a reboot - so the promise is kept
 * here instead. A guard in the code also covers the button being pressed on a
 * machine where the task *is* installed, which no scheduler setting can.
 *
 * ## Two models, and neither is chosen here
 *
 * `MODELS` names the tier per job and this passes it explicitly, because a
 * session inherits whatever model launched it and putting the large model on the
 * fetch is the mistake that happens by accident. Whether it worked is not
 * checked here either: the session records itself in what it writes, and the
 * window reads that back. Configuration is intent, provenance is fact.
 */

import { spawn } from 'node:child_process';
import { appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { MODELS } from '../domain/models.js';
import { localDate } from '../domain/time.js';
import { openStore } from '../storage/store.js';
import { fetchAssignment, judgeAssignment } from './assignment.js';

/** @typedef {(stage: string, message: string) => void} Report */

/**
 * Run one session, resolving to whether it exited cleanly.
 *
 * @param {string} model
 * @param {string} prompt
 * @param {string} cwd
 * @param {Report} report
 * @param {string} stage
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
function session(model, prompt, cwd, report, stage) {
  return new Promise((resolve) => {
    // The prompt goes as one argument, never through a shell: assignments carry
    // newlines and quotes, and escaping them correctly is not a thing to rely on.
    const child = spawn('claude', ['--model', model, '-p', prompt], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false
    });

    let tail = '';
    const keep = (/** @type {Buffer} */ chunk) => {
      tail = `${tail}${chunk.toString()}`.slice(-2000);
    };
    child.stdout?.on('data', keep);
    child.stderr?.on('data', keep);

    const timer = setTimeout(() => child.kill(), 15 * 60 * 1000);

    child.on('error', (err) => {
      clearTimeout(timer);
      // The common one, and worth naming: the CLI is not on PATH for whatever
      // launched the app. "spawn claude ENOENT" tells nobody anything.
      const reason =
        /** @type {any} */ (err).code === 'ENOENT'
          ? 'The `claude` command was not found. It has to be on PATH for whatever started Brief - which is not always true for an app launched from the Start menu.'
          : err.message;
      report(stage, `failed: ${reason}`);
      resolve({ ok: false, reason });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ ok: true });
        return;
      }
      const reason = `exited ${code}${tail.trim() === '' ? '' : `: ${tail.trim().slice(-400)}`}`;
      report(stage, `failed: ${reason}`);
      resolve({ ok: false, reason });
    });
  });
}

/**
 * @param {object} options
 * @param {string} options.dataDir
 * @param {string} options.jotDir
 * @param {string} options.repoDir Working directory for the sessions.
 * @param {boolean} [options.force] Replace today's brief instead of skipping.
 * @param {Report} [options.onReport]
 * @returns {Promise<{ ok: boolean, skipped?: boolean, reason?: string }>}
 */
export async function runMorning({ dataDir, jotDir, repoDir, force = false, onReport }) {
  const now = Date.now();
  const today = localDate(now);

  /** @type {Report} */
  const report = (stage, message) => {
    onReport?.(stage, message);
    try {
      appendFileSync(join(dataDir, 'morning.log'), `${new Date(now).toISOString()}  ${stage}: ${message}\n`, 'utf8');
    } catch {
      // A missing log is not a reason to skip the brief.
    }
  };

  const store = openStore({ dataDir });
  const existing = store.read(today, now);
  if (!existing.missing && existing.brief.date === today && !force) {
    report('skipped', `today's brief already exists (${today})`);
    return { ok: true, skipped: true };
  }

  let assignment;
  try {
    assignment = fetchAssignment({ dataDir, jotDir });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    report('nothing to search for', reason);
    return { ok: false, reason };
  }

  report('fetch', `starting on ${MODELS.fetch.id}`);
  const fetched = await session(MODELS.fetch.id, assignment, repoDir, report, 'fetch');
  if (!fetched.ok) {
    return { ok: false, reason: fetched.reason };
  }

  // Checked, not assumed. A session can exit 0 having written nothing, and a
  // judge handed a missing file writes a brief out of thin air.
  if (!existsSync(join(dataDir, 'world.json'))) {
    const reason = 'the fetch exited cleanly but wrote no world.json';
    report('fetch', reason);
    return { ok: false, reason };
  }
  report('fetch', 'done');

  report('judge', `starting on ${MODELS.judge.id}`);
  const judged = await session(MODELS.judge.id, judgeAssignment({ dataDir }), repoDir, report, 'judge');
  if (!judged.ok) {
    return { ok: false, reason: judged.reason };
  }

  const after = openStore({ dataDir }).read(today, now);
  if (after.missing) {
    const reason = 'the judge exited cleanly but there is still no brief for today';
    report('judge', reason);
    return { ok: false, reason };
  }

  report(
    'done',
    `${after.brief.world.needsYou.length} need you, ${after.brief.world.worthKnowing.length} worth knowing, ${after.brief.confirm.length} to confirm`
  );
  return { ok: true };
}
