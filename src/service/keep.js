/**
 * Where a kept thing goes.
 *
 * `confirmed.jsonl` already records every verdict, and that file is the audit
 * trail: it is how you find out later that a generator's suggestions were mostly
 * rubbish. But it is a log, not a place you would ever read, and a "Keep it"
 * button whose only effect is a line in a log is a button that does nothing.
 *
 * So keeping something also appends it to `kept.md`, in the data directory,
 * grouped by kind and in the order it happened. Markdown because it is the one
 * format that is readable without the app, greppable, and safe to paste
 * somewhere else.
 *
 * ## Why not Nib, which is where this belongs
 *
 * It does belong there - a kept story is a note, and Nib owns notes. Two things
 * stop it today, and both are worth writing down rather than working around:
 *
 * Nib's data directory is still Electron's `userData`, which sits inside the
 * area an agent session's writes get redirected away from. A note written there
 * by anything other than Nib itself lands in a private overlay and Nib never
 * sees it. Nib's own `data-dir.ts` says exactly this, and the fix is on its side
 * (`NIB_DATA_DIR` pointing somewhere real, which it migrates to on its own).
 *
 * And Ledger, which is where decisions are supposed to end up, does not exist.
 *
 * `kept.md` is therefore the seam, not the answer. When Nib is relocated, this
 * module gains a second destination and `kept.md` becomes the fallback for
 * anything with nowhere better to go.
 */

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** @param {number} at */
function stamp(at) {
  const date = new Date(at);
  const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Append one kept candidate to `kept.md`.
 *
 * Append-only, like the log beside it: a file that is only ever added to cannot
 * lose an entry to a bad write, and nothing here is ever worth rewriting.
 *
 * @param {string} dataDir
 * @param {import('../domain/brief.js').Candidate} candidate
 * @param {number} now
 * @returns {{ path: string, wrote: boolean }}
 */
export function keep(dataDir, candidate, now) {
  const path = join(dataDir, 'kept.md');

  if (!existsSync(path)) {
    appendFileSync(
      path,
      '# Kept\n\n' +
        'Things confirmed from a brief. Append-only, newest at the bottom.\n' +
        'Written by Brief; safe to read, copy out of, or move somewhere better.\n\n',
      'utf8'
    );
  }

  // Idempotent on the id, because the window can be clicked twice and a story
  // filed twice is worse than a story filed once - you cannot tell later which
  // copy you meant.
  if (existsSync(path) && readFileSync(path, 'utf8').includes(`<!-- id: ${candidate.id} -->`)) {
    return { path, wrote: false };
  }

  const lines = [
    `## ${candidate.kind} · ${stamp(now)}`,
    `<!-- id: ${candidate.id} -->`,
    '',
    candidate.text
  ];
  if (candidate.why) {
    lines.push('', `*Why:* ${candidate.why}`);
  }
  if (candidate.evidence) {
    lines.push('', `*From:* ${candidate.evidence}`);
  }
  lines.push('', '');

  appendFileSync(path, `${lines.join('\n')}\n`, 'utf8');
  return { path, wrote: true };
}

/**
 * Would a kept thing be better off in Nib?
 *
 * Reported to the window rather than acted on, because relocating Nib's data is
 * the user's decision about their own files and Nib migrates itself when they
 * make it.
 *
 * @returns {{ available: boolean, reason?: string }}
 */
export function nibDestination() {
  const dir = process.env.NIB_DATA_DIR;
  if (dir === undefined || dir.trim() === '') {
    return {
      available: false,
      reason:
        'Nib still keeps its notes in the default userData folder, which anything ' +
        'other than Nib writes into a private overlay. Set NIB_DATA_DIR to a real ' +
        'path and Nib moves its data there on its own.'
    };
  }
  if (!existsSync(join(dir.trim(), 'index.json'))) {
    return { available: false, reason: `No Nib index at ${dir.trim()} yet.` };
  }
  return { available: true };
}
