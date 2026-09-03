/**
 * One thing to learn, and the page behind it.
 *
 * The principle at the bottom of the page is a reminder of something already
 * known. This is the other half: a small piece of craft that is *not* known yet,
 * chosen for somebody who spends their days directing models rather than typing
 * the code, and who would like to still know how the machinery works in a year.
 *
 * Two shapes, and they live in two files on purpose.
 *
 *   The `Topic` is the card on the brief - a title and one sentence, the size of
 *   the principle beside it. It travels in `brief.json` because it is part of the
 *   morning page.
 *
 *   The `Article` is the three minutes behind the button, and it lives in
 *   `learn/<id>.json`. It is not on the brief for the reason the whole app
 *   exists: a brief has a bottom, and six hundred words of explainer inlined into
 *   it would be the first thing that took the bottom away. Putting it one click
 *   and one window away keeps the morning page the length it was.
 *
 * The article is data, never markup. The generator writes paragraphs, lists and
 * code as values; `service/article.js` turns them into HTML with everything
 * escaped. A model that could write raw HTML into a file this app opens in a
 * browser would be a model that could write a script tag, and "it would not do
 * that" is not a security boundary.
 */

/**
 * @typedef {object} Topic
 * @property {string} id Slug. Also names the article file, so it is checked.
 * @property {string} title What the topic is called.
 * @property {string} line One or two sentences: the gist, readable on its own.
 * @property {string} [why] What raised it today, when something did.
 */

/** @typedef {{ kind: 'text', text: string }} TextBlock */
/** @typedef {{ kind: 'list', items: string[] }} ListBlock */
/** @typedef {{ kind: 'code', language?: string, code: string }} CodeBlock */
/** @typedef {{ kind: 'aside', text: string }} AsideBlock */
/** @typedef {TextBlock | ListBlock | CodeBlock | AsideBlock} Block */

/**
 * @typedef {object} Section
 * @property {string} heading
 * @property {Block[]} blocks
 */

/**
 * @typedef {object} Article
 * @property {string} id
 * @property {string} title
 * @property {string} [standfirst] One sentence saying what you will know by the end.
 * @property {Section[]} sections
 * @property {string[]} takeaways The three or four things worth remembering.
 * @property {{ title: string, url: string }[]} sources Where to go deeper.
 */

/**
 * Is this an id we are willing to turn into a filename?
 *
 * The id comes out of a JSON file written by a model, and it is used to address
 * a file on disk. Lowercase letters, digits and hyphens - no dots, no slashes,
 * no backslashes - so there is nothing left to escape and `..` cannot be
 * spelled. A guard is cheaper than a review of every path join downstream.
 *
 * @param {unknown} id
 */
export function isTopicId(id) {
  return typeof id === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(id) && !id.endsWith('-');
}

/**
 * Read the card, or decide there is not one.
 *
 * Null rather than half a card, exactly as the principle does it. A title with
 * no sentence under it is a heading, and a heading with a button next to it is
 * an invitation to find out what the app forgot to say.
 *
 * The id has to be usable, because the button behind the card opens
 * `learn/<id>.json` and a card whose button cannot work is worse than no card.
 *
 * @param {unknown} raw
 * @returns {Topic | null}
 */
export function parseTopic(raw) {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const entry = /** @type {any} */ (raw);
  const title = str(entry.title).trim();
  const line = str(entry.line).trim();
  const id = str(entry.id).trim();
  if (title === '' || line === '' || !isTopicId(id)) {
    return null;
  }
  return {
    id,
    title,
    line,
    why: str(entry.why).trim() || undefined
  };
}

/**
 * Read the article, dropping anything that would render as a blank.
 *
 * Forgiving about shape and strict about emptiness, for the same reason
 * `parseBrief` is: the file is written by a model, and a section that lost its
 * heading should cost that section rather than the morning. What it will not do
 * is produce a page with nothing on it - an article with no readable section is
 * null, and the card then renders without its button.
 *
 * @param {unknown} raw
 * @returns {Article | null}
 */
export function parseArticle(raw) {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const entry = /** @type {any} */ (raw);
  const title = str(entry.title).trim();
  if (title === '') {
    return null;
  }

  /** @type {Section[]} */
  const sections = [];
  for (const item of list(entry.sections)) {
    const section = /** @type {any} */ (item);
    if (section === null || typeof section !== 'object') {
      continue;
    }
    const blocks = list(section.blocks).map(parseBlock).filter(/** @returns {block is Block} */ (block) => block !== null);
    const heading = str(section.heading).trim();
    if (heading === '' && blocks.length === 0) {
      continue;
    }
    sections.push({ heading, blocks });
  }

  if (sections.every((section) => section.blocks.length === 0)) {
    return null;
  }

  return {
    id: isTopicId(str(entry.id).trim()) ? str(entry.id).trim() : 'topic',
    title,
    standfirst: str(entry.standfirst).trim() || undefined,
    sections,
    takeaways: list(entry.takeaways).map((line) => str(line).trim()).filter((line) => line !== ''),
    // Same rule as a story's sources: no url, no link. A link that goes nowhere
    // is worse than no link, and this page is read away from the app where
    // there is nothing to fall back to.
    sources: list(entry.sources)
      .map((source) => ({
        title: str(/** @type {any} */ (source)?.title).trim(),
        url: str(/** @type {any} */ (source)?.url).trim()
      }))
      .filter((source) => /^https?:\/\//i.test(source.url))
      .map((source) => ({ title: source.title || source.url, url: source.url }))
  };
}

/**
 * @param {unknown} raw
 * @returns {Block | null}
 */
function parseBlock(raw) {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const block = /** @type {any} */ (raw);

  if (block.kind === 'list') {
    const items = list(block.items).map((item) => str(item).trim()).filter((item) => item !== '');
    return items.length === 0 ? null : { kind: 'list', items };
  }

  if (block.kind === 'code') {
    // Trailing whitespace only, never leading: the indentation is the code.
    const code = str(block.code).replace(/\s+$/, '');
    return code === '' ? null : { kind: 'code', language: str(block.language).trim() || undefined, code };
  }

  if (block.kind === 'aside') {
    const text = str(block.text).trim();
    return text === '' ? null : { kind: 'aside', text };
  }

  // Anything else reads as prose, including a block that forgot to say what it
  // is. A paragraph rendered as a paragraph is never wrong; dropping it is.
  const text = str(block.text).trim();
  return text === '' ? null : { kind: 'text', text };
}

/**
 * How long the page actually takes to read.
 *
 * Measured, not declared. The generator is asked for about three minutes, and a
 * generator that writes twelve hundred words while the card says "3 min" has
 * told the reader something untrue about their own morning - which is exactly
 * the kind of small lie that stops a page being opened at all. So the number on
 * the card comes from counting the words that are there.
 *
 * Code is counted at a third of the rate of prose, because it is not read at
 * prose speed.
 *
 * @param {Article} article
 * @returns {number} whole minutes, never zero
 */
export function readingMinutes(article) {
  let words = 0;
  const count = (/** @type {string} */ text) => text.trim().split(/\s+/).filter(Boolean).length;

  words += count(article.title) + count(article.standfirst ?? '');
  for (const section of article.sections) {
    words += count(section.heading);
    for (const block of section.blocks) {
      if (block.kind === 'list') {
        words += block.items.reduce((total, item) => total + count(item), 0);
      } else if (block.kind === 'code') {
        words += count(block.code) * 3;
      } else {
        words += count(block.text);
      }
    }
  }
  words += article.takeaways.reduce((total, line) => total + count(line), 0);

  return Math.max(1, Math.round(words / 200));
}

/** @param {unknown} value */
const str = (value) => (typeof value === 'string' ? value : '');

/** @param {unknown} value */
const list = (value) => (Array.isArray(value) ? value : []);
