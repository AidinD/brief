/**
 * Everything the app can do, in one place.
 *
 * Thin, because Brief genuinely does very little: it reads a file somebody else
 * wrote, and it records the handful of yes/no answers you give it. The reason
 * it is a layer at all rather than four functions in main is the seam - Tend
 * learned that a second client (its MCP server) has to call the *same* code as
 * the window, or the two grow different answers to the same question. Brief
 * will want that second client eventually; this is where it attaches.
 */

import { localDate } from '../domain/time.js';
import { holdings } from './holdings.js';

/**
 * @param {ReturnType<typeof import('../storage/store.js').openStore>} store
 * @param {number} now
 */
export function today(store, now) {
  const date = localDate(now);
  const { brief, dropped, problems, missing } = store.read(date, now);
  return { brief, dropped, problems, missing, today: date };
}

/**
 * Answer one candidate.
 *
 * The brief file is left alone. It is a snapshot of what was suggested, and
 * rewriting it to remove what you answered would destroy the record of what the
 * generator proposed - which is the only way to tell later that its suggestions
 * were mostly rubbish.
 *
 * @param {ReturnType<typeof import('../storage/store.js').openStore>} store
 * @param {string} id
 * @param {'accepted' | 'rejected'} verdict
 * @param {number} now
 */
export function answer(store, id, verdict, now) {
  const { brief } = store.read(localDate(now), now);
  const candidate = brief.confirm.find((item) => item.id === id);
  if (candidate === undefined) {
    return { error: `No candidate with id "${id}" in today's brief.` };
  }
  store.confirm(candidate, verdict, now);
  return { id, verdict };
}

/**
 * Which ids already have an answer, so the window can grey them out.
 *
 * @param {ReturnType<typeof import('../storage/store.js').openStore>} store
 */
export function answered(store) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const record of store.confirmed()) {
    if (typeof record?.id === 'string' && typeof record?.verdict === 'string') {
      out[record.id] = record.verdict;
    }
  }
  return out;
}

/**
 * @param {object} where
 * @param {string} where.dataDir
 * @param {string} where.jotDir
 */
export const context = (where) => ({ holdings: holdings(where) });
