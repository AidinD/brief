/**
 * What is allowed to leave this machine.
 *
 * Brief works out what you are holding by reading your Jot board, and that was
 * going to be the search filter - derived rather than configured, which is the
 * right idea and nearly shipped as a privacy bug.
 *
 * The board is not a list of neutral topic words. On this machine it contains
 * internal project codenames on the work side and, on the private side, things
 * like which books someone is reading and which companies they have applied to.
 * Deriving the filter from it and posting the result to Google would have sent
 * all of that out, once a morning, in exchange for slightly better news.
 *
 * So the derivation stays local and the *sending* is opt-in, item by item.
 * `outbound.json` is a list the user has looked at and ticked. Nothing without
 * `send: true` ever reaches a request body, and an empty list means the fetch
 * refuses rather than falling back to everything.
 *
 * The rule this encodes, which is worth keeping when this file is rewritten:
 * a default that leaks is not fixed by a warning. It is fixed by not being the
 * default.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripBom } from 'keel/storage';

/** @typedef {import('./holdings.js').Holding} Holding */
/** @typedef {{ label: string, kind: string, send: boolean, as?: string }} Entry */

/** @param {string} dataDir */
export const outboundPath = (dataDir) => join(dataDir, 'outbound.json');

/**
 * Read the list, whatever state it is in.
 *
 * @param {string} dataDir
 * @returns {Entry[]}
 */
export function readOutbound(dataDir) {
  const path = outboundPath(dataDir);
  if (!existsSync(path)) {
    return [];
  }
  try {
    const raw = JSON.parse(stripBom(readFileSync(path, 'utf8')));
    const items = Array.isArray(raw) ? raw : Array.isArray(raw?.allow) ? raw.allow : [];
    return items
      .filter((/** @type {any} */ item) => typeof item?.label === 'string' && item.label.trim() !== '')
      .map((/** @type {any} */ item) => ({
        label: String(item.label).trim(),
        kind: typeof item.kind === 'string' ? item.kind : 'area',
        send: item.send === true,
        as: typeof item.as === 'string' && item.as.trim() !== '' ? item.as.trim() : undefined
      }));
  } catch {
    return [];
  }
}

/**
 * The terms that may actually be sent.
 *
 * `as` exists for the case that comes up immediately: an internal codename you
 * do want news about, under a description that gives nothing away. "Kestrel"
 * becomes "AI-assisted content pipelines". The search is as good and the
 * codename stays here.
 *
 * @param {string} dataDir
 * @returns {{ label: string, kind: string }[]}
 */
export const sendable = (dataDir) =>
  readOutbound(dataDir)
    .filter((entry) => entry.send)
    .map((entry) => ({ label: entry.as ?? entry.label, kind: entry.kind }));

/**
 * Write a draft list from what you are holding, with everything switched off.
 *
 * Off is the whole point. A generated file that arrives ticked is a file nobody
 * reads, and this one exists to be read.
 *
 * Choices already made are kept, so re-running this after the board changes
 * adds the new items without undoing any decision.
 *
 * @param {string} dataDir
 * @param {Holding[]} holdings
 * @returns {{ path: string, added: number, total: number }}
 */
export function draftOutbound(dataDir, holdings) {
  const existing = new Map(readOutbound(dataDir).map((entry) => [`${entry.kind}|${entry.label.toLowerCase()}`, entry]));
  let added = 0;

  /** @type {Entry[]} */
  const entries = [];
  for (const holding of holdings) {
    const key = `${holding.kind}|${holding.label.toLowerCase()}`;
    const previous = existing.get(key);
    if (previous !== undefined) {
      entries.push(previous);
      existing.delete(key);
      continue;
    }
    added += 1;
    entries.push({ label: holding.label, kind: holding.kind, send: false });
  }

  // Anything the board no longer has but the user had ticked stays. Removing a
  // task from Jot is not a decision about what may be searched for.
  for (const leftover of existing.values()) {
    entries.push(leftover);
  }

  writeOutbound(dataDir, entries);
  return { path: outboundPath(dataDir), added, total: entries.length };
}

/** @param {string} dataDir @param {Entry[]} entries */
function writeOutbound(dataDir, entries) {
  writeFileSync(
    outboundPath(dataDir),
    `${JSON.stringify(
      {
        _: [
          'What may be sent to a third party when fetching news. Nothing here leaves',
          'this machine unless send is true. Set "as" to send a neutral description',
          'instead of the label itself - useful for internal project names.'
        ],
        allow: entries
      },
      null,
      2
    )}\n`,
    'utf8'
  );
}

/**
 * Change one entry, creating it if the list has not seen it.
 *
 * One at a time, and there is deliberately no "allow everything" anywhere in
 * this module. The decision the file records is per item by design, and a switch
 * that flips fifty of them is a switch that gets flipped without reading -
 * which leaves you with the leak the list exists to prevent, plus the false
 * comfort of having a list.
 *
 * @param {string} dataDir
 * @param {{ label: string, kind?: string, send?: boolean, as?: string | null }} change
 * @returns {Entry[]} The list as it now stands.
 */
export function setEntry(dataDir, change) {
  const label = String(change.label ?? '').trim();
  if (label === '') {
    throw new Error('An outbound entry needs a label.');
  }

  const kind = change.kind ?? 'area';
  const entries = readOutbound(dataDir);
  const key = `${kind}|${label.toLowerCase()}`;
  const existing = entries.find((entry) => `${entry.kind}|${entry.label.toLowerCase()}` === key);
  const as = change.as === null || change.as === undefined ? undefined : String(change.as).trim() || undefined;

  if (existing === undefined) {
    entries.push({ label, kind, send: change.send === true, as });
  } else {
    if (change.send !== undefined) {
      existing.send = change.send === true;
    }
    if ('as' in change) {
      existing.as = as;
    }
  }

  writeOutbound(dataDir, entries);
  return entries;
}
