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

import { join } from 'node:path';

import { checkProvenance } from '../domain/models.js';
import { readingMinutes } from '../domain/learn.js';
import { localDate } from '../domain/time.js';
import { renderArticle } from './article.js';
import { holdings } from './holdings.js';
import { readInterests, removeInterest, renameInterest, searchable, setInterest, weakness } from './interests.js';
import { keep } from './keep.js';
import { draftOutbound, readOutbound, sendable, setEntry } from './outbound.js';

/**
 * @param {ReturnType<typeof import('../storage/store.js').openStore>} store
 * @param {number} now
 */
export function today(store, now) {
  const date = localDate(now);
  const { brief, dropped, problems, doubts, missing } = store.read(date, now);

  // Checked here rather than in the renderer so the window and any other client
  // reach the same verdict about the same brief.
  const models = missing
    ? []
    : /** @type {const} */ (['fetch', 'judge'])
        .map((job) => checkProvenance(brief.provenance?.[job], job))
        .filter((result) => !result.ok);

  /*
   * Whether the topic has a page behind it, and how long it takes.
   *
   * Worked out here rather than in the window for the same reason the model
   * check is: the renderer has no filesystem, and a "Learn more" button that
   * opens nothing is the one way this section can be worse than absent. Same
   * rule as a story's sources - a link that goes nowhere is worse than no link.
   *
   * The minutes are measured off the page, never taken from the brief. A card
   * claiming three minutes over a twelve-minute article is a small lie about
   * somebody's morning, and small lies about the morning are how a page stops
   * being opened.
   */
  const piece = missing ? null : store.article(brief.learn?.id);
  const article = { ready: piece !== null, minutes: piece === null ? null : readingMinutes(piece) };

  return { brief, dropped, problems, doubts, missing, today: date, models, article };
}

/**
 * Render today's deep dive and say where it landed.
 *
 * Takes no id. The renderer could pass one, and then the window would be able
 * to ask for any file in `learn/` - which is a capability nothing needs and
 * somebody would eventually widen. The only article this app opens is the one
 * today's brief points at.
 *
 * @param {ReturnType<typeof import('../storage/store.js').openStore>} store
 * @param {number} now
 */
export function learnPage(store, now) {
  const date = localDate(now);
  const { brief, missing } = store.read(date, now);
  if (missing || brief.learn === null) {
    return { error: "There is no topic on today's brief." };
  }
  const article = store.article(brief.learn.id);
  if (article === null) {
    return { error: `Nothing was written for "${brief.learn.title}". The page would have been learn/${brief.learn.id}.json.` };
  }
  return { path: store.writeArticlePage(article.id, renderArticle(article, { date: brief.date })) };
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

  // The log records both verdicts. Only a yes gets written somewhere a person
  // would actually read - a no is evidence about the generator, not a keepsake.
  store.confirm(candidate, verdict, now);
  const kept = verdict === 'accepted' ? keep(store.dataDir, candidate, now) : null;

  return { id, verdict, keptAt: kept?.path ?? null };
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

/**
 * How much you have kept, and where it went.
 *
 * The window needs this because "Keep it" was invisible: the row greyed out and
 * nothing else happened, so the button read as a no-op and the section read as
 * busywork. A growing file you can open is the difference between a control and
 * a gesture.
 *
 * @param {ReturnType<typeof import('../storage/store.js').openStore>} store
 */
export function kept(store) {
  const count = store.confirmed().filter((record) => record.verdict === 'accepted').length;
  return { count, path: join(store.dataDir, 'kept.md') };
}

/**
 * The send list, for review in the window.
 *
 * Returns the entries *and* the exact terms that would go out, because the
 * second is the only thing that actually matters and it is not obvious from the
 * first - an entry with `as` set sends something different from its own label.
 * A privacy control you have to mentally compile is one you will misread.
 *
 * @param {object} where
 * @param {string} where.dataDir
 * @param {string} where.jotDir
 */
export function outbound({ dataDir, jotDir }) {
  const entries = readOutbound(dataDir);
  const held = holdings({ dataDir, jotDir });

  // Which holdings the list has not been asked about yet. A board grows, and an
  // item nobody has ruled on should look different from one ruled out.
  const known = new Set(entries.map((entry) => `${entry.kind}|${entry.label.toLowerCase()}`));
  const unreviewed = held.filter((holding) => !known.has(`${holding.kind}|${holding.label.toLowerCase()}`)).length;

  return { entries, sending: sendable(dataDir), unreviewed, held: held.length };
}

/**
 * @param {object} where
 * @param {string} where.dataDir
 * @param {{ label: string, kind?: string, send?: boolean, as?: string | null }} change
 */
export function setOutbound({ dataDir }, change) {
  setEntry(dataDir, change);
  return { ok: true };
}

/**
 * Pull in anything new from the board, switched off.
 *
 * @param {object} where
 * @param {string} where.dataDir
 * @param {string} where.jotDir
 */
export function refreshOutbound({ dataDir, jotDir }) {
  const { added, total } = draftOutbound(dataDir, holdings({ dataDir, jotDir }));
  return { added, total };
}

/* -------------------------------------------------------------- interests -- */

/**
 * The standing topics, each carrying whatever the window should say about it.
 *
 * The advice travels with the row rather than being worked out in the renderer,
 * so the window and the CLI say the same thing about the same term.
 *
 * @param {object} where
 * @param {string} where.dataDir
 */
export function interests({ dataDir }) {
  return {
    interests: readInterests(dataDir).map((item) => ({ ...item, advice: weakness(item) })),
    searching: searchable(dataDir)
  };
}

/**
 * @param {object} where
 * @param {string} where.dataDir
 * @param {{ term: string, why?: string | null, send?: boolean }} change
 */
export function setInterestOp({ dataDir }, change) {
  setInterest(dataDir, change);
  return { ok: true };
}

/**
 * @param {object} where
 * @param {string} where.dataDir
 * @param {{ term: string }} which
 */
export function removeInterestOp({ dataDir }, which) {
  removeInterest(dataDir, which.term);
  return { ok: true };
}

/**
 * Rename an interest in place.
 *
 * Returns the refusal rather than throwing, because the caller is a text field:
 * a rejected rename has to put the old wording back and say why, and an
 * exception across the IPC boundary arrives without the sentence.
 *
 * @param {object} where
 * @param {string} where.dataDir
 * @param {{ from: string, to: string }} which
 */
export function renameInterestOp({ dataDir }, which) {
  try {
    renameInterest(dataDir, which.from, which.to);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
