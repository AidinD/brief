/**
 * What you are interested in, as opposed to what you are holding.
 *
 * These are two different things and the first version of Brief only had the
 * second, which made the app unable to do the thing it was asked for. Your Jot
 * board says Northwind and Meteor Run; it will never say Unity, or leadership, or
 * EU AI regulation. Those are standing professional interests - they are about
 * who you are, not about what is in progress this week - and there is no way to
 * derive them from anything.
 *
 * So the split is:
 *
 *   interests   what gets searched for. Written by you.
 *   holdings    what makes a hit matter TO YOU. Derived from Jot.
 *
 * A holding is a poor search term and a good sharpener. "Household" is a filing
 * label; sending those two words to a search engine gets you nothing. But
 * "Roblox changed its payout model" *plus* "Meteor Run is on your board" is
 * the difference between worth-knowing and needs-you, and that is the job
 * holdings are actually good at.
 *
 * ## Why interests default to sendable
 *
 * Because you typed them. Writing "Unity" into a field labelled "what should
 * Brief look for" is itself the disclosure decision - there is nothing left to
 * consent to, and asking twice trains people to click through consent screens.
 *
 * Holdings are the opposite: Brief derived them from a private file without
 * asking, so they default to off and are ticked one at a time. Same rule, two
 * honest answers, because the two lists were created in different ways.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripBom } from 'keel/storage';

/** @typedef {{ term: string, why?: string, send: boolean }} Interest */

/** @param {string} dataDir */
export const interestsPath = (dataDir) => join(dataDir, 'interests.json');

/**
 * @param {string} dataDir
 * @returns {Interest[]}
 */
export function readInterests(dataDir) {
  const path = interestsPath(dataDir);
  if (!existsSync(path)) {
    return [];
  }
  try {
    const raw = JSON.parse(stripBom(readFileSync(path, 'utf8')));
    const items = Array.isArray(raw) ? raw : Array.isArray(raw?.interests) ? raw.interests : [];
    return items
      .filter((/** @type {any} */ item) => typeof item?.term === 'string' && item.term.trim() !== '')
      .map((/** @type {any} */ item) => ({
        term: String(item.term).trim(),
        why: typeof item.why === 'string' && item.why.trim() !== '' ? item.why.trim() : undefined,
        // Absent means yes. An interests file hand-written without the field
        // should work the way the person who wrote it obviously meant.
        send: item.send !== false
      }));
  } catch {
    return [];
  }
}

/** @param {string} dataDir @param {Interest[]} interests */
function writeInterests(dataDir, interests) {
  writeFileSync(
    interestsPath(dataDir),
    `${JSON.stringify(
      {
        _: [
          'Standing topics Brief searches for. Written by you, so they are sent by',
          'default - set send to false to keep one without searching for it.',
          'A "why" is worth writing: it is what lets a hit be judged as needing you',
          'rather than merely being about the topic.'
        ],
        interests
      },
      null,
      2
    )}\n`,
    'utf8'
  );
}

/**
 * Add or change one interest, keyed on the term.
 *
 * @param {string} dataDir
 * @param {{ term: string, why?: string | null, send?: boolean }} change
 * @returns {Interest[]}
 */
export function setInterest(dataDir, change) {
  const term = String(change.term ?? '').trim();
  if (term === '') {
    throw new Error('An interest needs a term.');
  }

  const interests = readInterests(dataDir);
  const existing = interests.find((item) => item.term.toLowerCase() === term.toLowerCase());
  const why =
    change.why === null || change.why === undefined ? undefined : String(change.why).trim() || undefined;

  if (existing === undefined) {
    interests.push({ term, why, send: change.send !== false });
  } else {
    if ('why' in change) {
      existing.why = why;
    }
    if (change.send !== undefined) {
      existing.send = change.send === true;
    }
  }

  writeInterests(dataDir, interests);
  return interests;
}

/**
 * @param {string} dataDir @param {string} term
 * @returns {Interest[]}
 */
export function removeInterest(dataDir, term) {
  const wanted = String(term ?? '').trim().toLowerCase();
  const interests = readInterests(dataDir).filter((item) => item.term.toLowerCase() !== wanted);
  writeInterests(dataDir, interests);
  return interests;
}

/**
 * The interests that actually go into a search, with their reasons.
 *
 * @param {string} dataDir
 * @returns {{ term: string, why?: string }[]}
 */
export const searchable = (dataDir) =>
  readInterests(dataDir)
    .filter((item) => item.send)
    .map((item) => ({ term: item.term, why: item.why }));

/**
 * Words that will not survive contact with a news search.
 *
 * Not a validation rule - you are allowed to write whatever you like - but the
 * window says so, because the alternative is finding out after a week of bad
 * briefs. Two failure modes, and they are different:
 *
 *   Ambiguous: one short noun that names several unrelated things. "Unity" is
 *   an engine, a concept, and a Linux desktop.
 *
 *   Unnewsworthy: an abstraction nothing happens *to* in a 48-hour window.
 *   There is no news about leadership; there are opinion pieces about it. What
 *   works is the concrete change - a company publishing its engineering ladder,
 *   an org changing how it reviews people - and that has to be asked for.
 *
 * A `why` fixes both, which is why this returns advice rather than an error.
 *
 * @param {{ term: string, why?: string }} interest
 * @returns {string | null}
 */
export function weakness({ term, why }) {
  if (why !== undefined && why.trim() !== '') {
    return null;
  }

  const words = term.trim().split(/\s+/);
  const ABSTRACT = /^(ledarskap|leadership|management|kultur|culture|produktivitet|productivity|innovation|teknik|technology|tech|politik|politics|ai|business|strategi|strategy)$/i;

  if (words.length === 1 && ABSTRACT.test(words[0])) {
    return 'Nothing happens to a word this broad in 48 hours - a search returns opinion pieces. Say what change you would want to hear about.';
  }
  if (words.length === 1 && term.trim().length <= 12) {
    return 'One word can mean several things. A line on why you care makes the difference between "needs you" and "about that topic".';
  }
  return null;
}
