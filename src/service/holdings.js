/**
 * What you are holding, which is the only definition of "relevant" this app has.
 *
 * The failure mode of every news filter is topic words. Ask for "technology"
 * and "politics" and you get everything, because those are categories, not
 * interests. Relevance is a function of what you are actually carrying: that
 * Roblox changed its monetisation model matters *because* Northwind and
 * Meteor Run are on your board this week, and stops mattering when they are
 * not.
 *
 * So the filter is derived rather than configured. Nothing to keep up to date,
 * and it goes stale on its own in the right direction.
 *
 * Two sources, and they are deliberately different in kind:
 *
 *   Jot   read directly. It is one JSON file with a documented contract, and
 *         reading it is cheaper and more reliable than asking anything.
 *   Tend  supplied, not read. Its store is an append-only event log that means
 *         nothing without Tend's own reducer, and duplicating that reducer here
 *         is how two apps start disagreeing about what the role map says. The
 *         session assembling a brief already has Tend's MCP server; it writes
 *         what it found into `holdings.json` beside the brief.
 *
 * **This list is local.** It is not the search filter, however much it looks
 * like one. A board carries internal project codenames and, on the private
 * side, what someone is reading and where they have applied - deriving a query
 * from it and posting that to a search API sends all of it out. What may leave
 * the machine is in `outbound.js`, opt-in and item by item. See DECISIONS.md,
 * "Derived locally, sent only on purpose".
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripBom } from 'keel/storage';

/** @typedef {{ kind: string, label: string, detail?: string }} Holding */

/**
 * Read Jot's board.
 *
 * Categories first, because a category is a standing commitment - it is on the
 * board because it is part of the job. Then the work actually moving, which is
 * what makes a category *this week's* concern rather than a general one.
 *
 * @param {string} jotDir
 * @returns {Holding[]}
 */
export function fromJot(jotDir) {
  const path = join(jotDir, 'todos.json');
  if (!existsSync(path)) {
    return [];
  }

  let data;
  try {
    data = JSON.parse(stripBom(readFileSync(path, 'utf8')));
  } catch {
    return [];
  }

  const categories = Array.isArray(data?.categories) ? data.categories : [];
  const todos = Array.isArray(data?.todos) ? data.todos : [];
  const byId = new Map(categories.map((/** @type {any} */ c) => [c.id, c.name]));

  /** @type {Holding[]} */
  const holdings = categories
    .filter((/** @type {any} */ c) => typeof c.name === 'string' && c.name.trim() !== '')
    .map((/** @type {any} */ c) => ({ kind: 'area', label: String(c.name).trim() }));

  for (const todo of todos) {
    if (todo?.status !== 'in-progress' || typeof todo?.text !== 'string') {
      continue;
    }
    holdings.push({
      kind: 'in progress',
      label: todo.text.trim(),
      detail: byId.get(todo.categoryId) ?? undefined
    });
  }

  return holdings;
}

/**
 * Whatever the session put in `holdings.json` - the Tend half, and anything
 * else worth treating as context.
 *
 * @param {string} dataDir
 * @returns {Holding[]}
 */
export function fromFile(dataDir) {
  const path = join(dataDir, 'holdings.json');
  if (!existsSync(path)) {
    return [];
  }
  try {
    const raw = JSON.parse(stripBom(readFileSync(path, 'utf8')));
    const items = Array.isArray(raw) ? raw : Array.isArray(raw?.holdings) ? raw.holdings : [];
    return items
      .filter((/** @type {any} */ h) => typeof h?.label === 'string' && h.label.trim() !== '')
      .map((/** @type {any} */ h) => ({
        kind: typeof h.kind === 'string' && h.kind.trim() !== '' ? h.kind.trim() : 'context',
        label: String(h.label).trim(),
        detail: typeof h.detail === 'string' && h.detail.trim() !== '' ? h.detail.trim() : undefined
      }));
  } catch {
    return [];
  }
}

/**
 * Both sources, de-duplicated on `kind|label`.
 *
 * @param {object} where
 * @param {string} where.dataDir
 * @param {string} where.jotDir
 * @returns {Holding[]}
 */
export function holdings({ dataDir, jotDir }) {
  const seen = new Set();
  /** @type {Holding[]} */
  const out = [];
  for (const holding of [...fromJot(jotDir), ...fromFile(dataDir)]) {
    const key = `${holding.kind}|${holding.label.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(holding);
  }
  return out;
}
