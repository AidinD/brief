/**
 * What a brief is, and the limits that make it one.
 *
 * A brief has a bottom. That is the whole product: you open it once, you reach
 * the end, you close it. Every reading surface that lost that property lost it
 * the same way - not by deciding to become infinite, but by letting one more
 * item in, a hundred times.
 *
 * So the limits below are code, not guidance. `clamp` drops what is over, and
 * says so. A generator that keeps overflowing is producing a worse brief, and
 * the honest response is to fix the filter, not to scroll further - which is
 * why the overflow is reported rather than silently trimmed.
 *
 * There is no unread count anywhere in this app, and no badge. Deliberately.
 */

/**
 * The caps.
 *
 * `needsYou` is the smallest because it is the only section that asks for
 * anything. Five things that need you on a Tuesday is already a bad Tuesday; a
 * list of twelve is a list nobody reads to the end of, which means the two that
 * mattered are now hidden behind ten that did not.
 */
export const LIMITS = {
  needsYou: 5,
  worthKnowing: 7,
  confirm: 5,
  moments: 6
};

/** @typedef {{ title: string, url: string }} Source */

/**
 * @typedef {object} WorldItem
 * @property {string} id
 * @property {string} headline
 * @property {string} why Why this reaches *you* - phrased against something you hold.
 * @property {string} [anchor] What it attaches to: a Jot category, a duty, a person.
 * @property {Source[]} [sources]
 */

/**
 * @typedef {object} Candidate
 * @property {string} id
 * @property {'decision' | 'story' | 'delegation' | 'person'} kind
 * @property {string} text
 * @property {string} [why]
 * @property {string} [evidence] Where it was noticed. A note, a task, a date.
 */

/**
 * @typedef {object} Brief
 * @property {number} version
 * @property {string} date `YYYY-MM-DD`, the day it is for.
 * @property {number} generatedAt
 * @property {{ needsYou: WorldItem[], worthKnowing: WorldItem[] }} world
 * @property {{ summary: string, moments: { id: string, text: string, when?: string }[] }} week
 * @property {Candidate[]} confirm
 * @property {string[]} [notes] Anything the generator wants to say about itself.
 */

export const CANDIDATE_KINDS = ['decision', 'story', 'delegation', 'person'];

/**
 * An empty but valid brief, which is what a quiet day looks like.
 *
 * @param {string} date @param {number} now
 * @returns {Brief}
 */
export function emptyBrief(date, now) {
  return {
    version: 1,
    date,
    generatedAt: now,
    world: { needsYou: [], worthKnowing: [] },
    week: { summary: '', moments: [] },
    confirm: [],
    notes: []
  };
}

/** @param {unknown} value */
const str = (value) => (typeof value === 'string' ? value : '');

/** @param {unknown} value */
const list = (value) => (Array.isArray(value) ? value : []);

/**
 * Read whatever is in the file into the shape above.
 *
 * Forgiving on purpose: the file is written by an agent, and an agent that
 * omits `sources` on one item should not blank the whole morning. What it will
 * not do is invent - a missing headline drops the item, because an entry with
 * no headline is not a shorter entry, it is a blank line that looks like a bug.
 *
 * @param {unknown} raw
 * @param {string} fallbackDate
 * @param {number} now
 * @returns {{ brief: Brief, problems: string[] }}
 */
export function parseBrief(raw, fallbackDate, now) {
  const problems = [];
  const input = raw !== null && typeof raw === 'object' ? /** @type {any} */ (raw) : {};

  if (raw !== null && typeof raw !== 'object') {
    problems.push('The brief file is not an object.');
  }

  /** @param {unknown[]} items @param {string} where */
  const worldItems = (items, where) => {
    const out = [];
    for (const item of items) {
      const entry = /** @type {any} */ (item);
      if (entry === null || typeof entry !== 'object' || str(entry.headline).trim() === '') {
        problems.push(`An item in ${where} has no headline and was dropped.`);
        continue;
      }
      out.push({
        id: str(entry.id) || `${where}-${out.length}`,
        headline: str(entry.headline).trim(),
        why: str(entry.why).trim(),
        anchor: str(entry.anchor).trim() || undefined,
        sources: list(entry.sources)
          .map((source) => ({ title: str(/** @type {any} */ (source).title), url: str(/** @type {any} */ (source).url) }))
          .filter((source) => source.url !== '')
      });
    }
    return out;
  };

  const world = input.world !== null && typeof input.world === 'object' ? input.world : {};
  const week = input.week !== null && typeof input.week === 'object' ? input.week : {};

  const confirm = [];
  for (const item of list(input.confirm)) {
    const entry = /** @type {any} */ (item);
    if (entry === null || typeof entry !== 'object' || str(entry.text).trim() === '') {
      problems.push('A confirm item has no text and was dropped.');
      continue;
    }
    const kind = CANDIDATE_KINDS.includes(entry.kind) ? entry.kind : 'decision';
    if (!CANDIDATE_KINDS.includes(entry.kind)) {
      problems.push(`A confirm item had kind "${str(entry.kind) || 'none'}"; read as a decision.`);
    }
    confirm.push({
      id: str(entry.id) || `confirm-${confirm.length}`,
      kind,
      text: str(entry.text).trim(),
      why: str(entry.why).trim() || undefined,
      evidence: str(entry.evidence).trim() || undefined
    });
  }

  const brief = {
    version: typeof input.version === 'number' ? input.version : 1,
    date: str(input.date) || fallbackDate,
    generatedAt: typeof input.generatedAt === 'number' ? input.generatedAt : now,
    world: {
      needsYou: worldItems(list(world.needsYou), 'needsYou'),
      worthKnowing: worldItems(list(world.worthKnowing), 'worthKnowing')
    },
    week: {
      summary: str(week.summary).trim(),
      moments: list(week.moments)
        .map((moment, index) => {
          const entry = /** @type {any} */ (moment);
          return {
            id: str(entry?.id) || `moment-${index}`,
            text: str(entry?.text).trim(),
            when: str(entry?.when).trim() || undefined
          };
        })
        .filter((moment) => moment.text !== '')
    },
    confirm,
    notes: list(input.notes).map(str).filter((note) => note !== '')
  };

  return { brief, problems };
}

/**
 * Enforce the bottom.
 *
 * Returns the trimmed brief and what was dropped, so the window can say it out
 * loud. An overflowing brief is a signal about the generator, and hiding that
 * signal is how a brief becomes a feed.
 *
 * @param {Brief} brief
 * @returns {{ brief: Brief, dropped: { section: string, count: number }[] }}
 */
export function clamp(brief) {
  /** @type {{ section: string, count: number }[]} */
  const dropped = [];

  /** @param {any[]} items @param {number} limit @param {string} section */
  const cut = (items, limit, section) => {
    if (items.length > limit) {
      dropped.push({ section, count: items.length - limit });
      return items.slice(0, limit);
    }
    return items;
  };

  return {
    brief: {
      ...brief,
      world: {
        needsYou: cut(brief.world.needsYou, LIMITS.needsYou, 'needs you'),
        worthKnowing: cut(brief.world.worthKnowing, LIMITS.worthKnowing, 'worth knowing')
      },
      week: {
        ...brief.week,
        moments: cut(brief.week.moments, LIMITS.moments, 'your week')
      },
      confirm: cut(brief.confirm, LIMITS.confirm, 'confirm')
    },
    dropped
  };
}

/**
 * Is this brief for today?
 *
 * The window says so rather than hiding it. A stale brief that looks current is
 * worse than no brief - you act on last Thursday believing it is this morning.
 *
 * @param {Brief} brief @param {string} today
 */
export const isStale = (brief, today) => brief.date !== today;
