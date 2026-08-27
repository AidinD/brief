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
  behind: 3,
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
 * One principle, drawn from the library in Nib.
 *
 * Singular, never a list, and that is the cap. Two principles a morning is a
 * reading list, and a reading list is not read - the whole value is that there
 * is exactly one thing to carry into the day.
 *
 * @typedef {object} Lesson
 * @property {string} id The Nib note it came from, so it is not repeated soon.
 * @property {string} title The line you remember it by.
 * @property {string} line The one sentence underneath it.
 * @property {string} [source] The book, so it can be looked up.
 * @property {string} [why] What on today's page brought it up, if anything did.
 */

/**
 * @typedef {object} Brief
 * @property {number} version
 * @property {string} date `YYYY-MM-DD`, the day it is for.
 * @property {number} generatedAt
 * @property {{ needsYou: WorldItem[], worthKnowing: WorldItem[] }} world
 * @property {WorldItem[]} behind Commitments past their interval, from Tend rather than the news.
 * @property {{ summary: string, moments: { id: string, text: string, when?: string }[] }} week
 * @property {Candidate[]} confirm
 * @property {Lesson | null} lesson One principle from the library, or nothing.
 * @property {{ fetch?: string, judge?: string }} [provenance] Which model produced which half.
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
    behind: [],
    week: { summary: '', moments: [] },
    confirm: [],
    lesson: null,
    notes: []
  };
}

/**
 * Read the principle, or decide there is not one.
 *
 * Returns null rather than a half-filled object. A title with no sentence under
 * it is a heading, and a sentence with no title is a fortune cookie; neither is
 * something you can carry into a day, and rendering either would teach the
 * reader to skip the bottom of the page.
 *
 * @param {unknown} raw
 * @returns {Lesson | null}
 */
export function parseLesson(raw) {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const entry = /** @type {any} */ (raw);
  const title = str(entry.title).trim();
  const line = str(entry.line).trim();
  if (title === '' || line === '') {
    return null;
  }
  return {
    id: str(entry.id).trim() || title,
    title,
    line,
    source: str(entry.source).trim() || undefined,
    why: str(entry.why).trim() || undefined
  };
}

/**
 * How old a dated source may be before the brief calls it out.
 *
 * The fetch is told to search the last 48 hours, but a primary source can
 * legitimately be a few days old - a filing, a changelog, a report published
 * Friday and read on Monday. Fourteen days is not a precision check; it is an
 * obviousness check, and it exists because a brief that presents old news as
 * this morning's is worse than a brief with nothing in it.
 */
export const STALE_SOURCE_DAYS = 14;

/**
 * The date a news URL carries in its own path, if it carries one.
 *
 * Publishers put it there: `/2026/03/23/`, `/2026-03-23-`, `/2026/03/`. This is
 * the only date available without fetching the page, and it is the publisher's
 * own claim rather than the model's - which is the point. A model that
 * misremembers when something happened will still quote the URL correctly.
 *
 * Returns null when there is no date to read, which is most URLs. Absence is
 * never treated as a problem: guessing would flag half the brief.
 *
 * @param {string} url
 * @returns {Date | null}
 */
export function dateInUrl(url) {
  const match = /(?:^|[/\-_])(20\d{2})[/\-_](0[1-9]|1[0-2])(?:[/\-_](0[1-9]|[12]\d|3[01]))?(?:[/\-_]|$)/.exec(
    String(url ?? '')
  );
  if (match === null) {
    return null;
  }
  const [, year, month, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day ?? '01')));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Is the date in this URL a name rather than a publication date?
 *
 * Specifications are named by their revision date, and the name goes in both the
 * slug and the title: `blog.modelcontextprotocol.io/posts/2026-07-28/`, titled
 * "The 2026-07-28 Specification". Read as a publication date it made the window
 * doubt a post that had gone up that morning.
 *
 * The tell is the ISO form. A publisher writing the day it published writes it
 * in prose - "August 24, 2026" - and only a designation is carried around as
 * `2026-07-28`. So a title repeating the URL's date verbatim is naming a thing,
 * not dating itself.
 *
 * @param {string} title
 * @param {Date} date
 */
export function titleNamesTheDate(title, date) {
  const [year, month, day] = date.toISOString().slice(0, 10).split('-');
  const written = [
    `${year}-${month}-${day}`,
    `${year}/${month}/${day}`,
    `${year}.${month}.${day}`,
    `${year}${month}${day}`
  ];
  return written.some((form) => String(title ?? '').includes(form));
}

/**
 * How many days before `now` a story's own sources were published, if they say.
 *
 * Takes the NEWEST dated source: a story can cite background alongside the news,
 * and the oldest link is not what the story is about.
 *
 * @param {{ anchor?: string, sources?: Source[] }} story
 * @param {number} now
 * @returns {number | null} null when nothing carried a date
 */
export function sourceAgeDays(story, now) {
  const cited = [
    { url: String(story.anchor ?? ''), title: '' },
    ...(story.sources ?? []).map((source) => ({
      url: String(source.url ?? ''),
      title: String(source.title ?? '')
    }))
  ];
  const dates = cited
    .map((source) => ({ title: source.title, date: dateInUrl(source.url) }))
    .filter((dated) => dated.date !== null && !titleNamesTheDate(dated.title, dated.date))
    .map((dated) => /** @type {Date} */ (dated.date).getTime());
  if (dates.length === 0) {
    return null;
  }
  return Math.floor((now - Math.max(...dates)) / 86400000);
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
 * @returns {{ brief: Brief, problems: string[], doubts: string[] }}
 */
export function parseBrief(raw, fallbackDate, now) {
  const problems = [];

  /*
   * Kept apart from `problems` on purpose. A problem means the file could not be
   * read - a missing headline, a broken shape. A doubt means it read perfectly
   * and says something that does not hold up. Filing the second under the first
   * made the window announce "Some of the brief could not be read" about a story
   * it had read exactly right, which is a worse lie than the one it was
   * reporting.
   */
  /** @type {string[]} */
  const doubts = [];
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
      /** @type {WorldItem} */
      const story = {
        id: str(entry.id) || `${where}-${out.length}`,
        headline: str(entry.headline).trim(),
        why: str(entry.why).trim(),
        anchor: str(entry.anchor).trim() || undefined,
        sources: list(entry.sources)
          .map((source) => ({ title: str(/** @type {any} */ (source).title), url: str(/** @type {any} */ (source).url) }))
          .filter((source) => source.url !== '')
      };

      // The story is kept, and the doubt is stated. Dropping it would hide the
      // fetch's mistake; presenting it silently would pass the mistake on. A
      // brief that quietly serves old news as this morning's is the one failure
      // that makes the whole thing untrustworthy - it happened on 2026-08-25,
      // where a Spotify layoff round from 2023 arrived under a March link.
      const age = sourceAgeDays(story, now);
      if (age !== null && age > STALE_SOURCE_DAYS) {
        doubts.push(
          `"${story.headline}" cites a source published ${age} days ago. The brief covers the last 48 hours; check the date before trusting it.`
        );
      }

      out.push(story);
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
    // Same shape as a world item, deliberately. What is owed reads exactly like
    // a story that reaches you - a headline, why it reaches you, what it hangs
    // off - and giving it a second shape would only mean a second renderer.
    behind: worldItems(list(input.behind), 'behind'),
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
    lesson: parseLesson(input.lesson),
    // Kept exactly as written. A brief that records nothing must stay recording
    // nothing, so the window can say "there is no way to tell" rather than
    // inventing a reassuring default.
    provenance: {
      fetch: str(/** @type {any} */ (input.provenance)?.fetch) || undefined,
      judge: str(/** @type {any} */ (input.provenance)?.judge) || undefined
    },
    notes: list(input.notes).map(str).filter((note) => note !== '')
  };

  return { brief, problems, doubts };
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
      // The tightest cap in the app, and the one most worth having. Everything
      // overdue at once is a backlog, and a backlog on a morning page is the
      // exact thing this app exists not to be. Three, and the rest is Tend's.
      behind: cut(brief.behind ?? [], LIMITS.behind, 'behind'),
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
