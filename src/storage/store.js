/**
 * Reading and writing the brief.
 *
 * Three files, and the split is deliberate:
 *
 *   brief.json        today's brief, written by whoever generated it
 *   archive/<date>.json   yesterday's, and the day before
 *   confirmed.jsonl   what you said yes to, append-only
 *   learn/<id>.json   the three minutes behind today's topic, and the page
 *                     this app renders out of it
 *
 * `brief.json` is disposable. It is regenerated every morning and nothing is
 * lost if it goes missing. `confirmed.jsonl` is not - it is the only thing in
 * here that is *yours*, the decisions and stories you accepted, and it is
 * append-only for the same reason Tend's log is: a file that is only ever
 * appended to cannot lose an entry to a bad write or a racing writer.
 *
 * It is JSONL rather than JSON so that a half-written last line costs one
 * record instead of the file. Ledger and Story bank will eventually read it;
 * until they exist this is where an accepted candidate lands.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

import { clamp, emptyBrief, parseBrief } from '../domain/brief.js';
import { isTopicId, parseArticle } from '../domain/learn.js';
import { stripBom } from 'keel/storage';

/**
 * @param {object} options
 * @param {string} options.dataDir
 * @param {(message: string) => void} [options.onWarning]
 */
export function openStore({ dataDir, onWarning = () => {} }) {
  mkdirSync(join(dataDir, 'archive'), { recursive: true });

  const briefPath = join(dataDir, 'brief.json');
  const confirmedPath = join(dataDir, 'confirmed.jsonl');
  const learnDir = join(dataDir, 'learn');

  /**
   * Today's brief, clamped.
   *
   * @param {string} today `YYYY-MM-DD`
   * @param {number} now
   */
  function read(today, now) {
    if (!existsSync(briefPath)) {
      return { ...clamp(emptyBrief(today, now)), problems: [], doubts: [], missing: true };
    }

    let raw;
    try {
      raw = JSON.parse(stripBom(readFileSync(briefPath, 'utf8')));
    } catch (err) {
      const message = `brief.json could not be read: ${err instanceof Error ? err.message : String(err)}`;
      onWarning(message);
      return { ...clamp(emptyBrief(today, now)), problems: [message], doubts: [], missing: true };
    }

    const { brief, problems, doubts } = parseBrief(raw, today, now);
    for (const problem of problems) {
      onWarning(problem);
    }
    return { ...clamp(brief), problems, doubts, missing: false };
  }

  /**
   * Put a brief in place, archiving whatever was there.
   *
   * Written to a temporary file and renamed, so a reader never sees a partial
   * brief - the app watches this file and would otherwise redraw mid-write.
   *
   * @param {import('../domain/brief.js').Brief} brief
   */
  function write(brief) {
    if (existsSync(briefPath)) {
      try {
        const previous = JSON.parse(stripBom(readFileSync(briefPath, 'utf8')));
        const date = typeof previous?.date === 'string' ? previous.date : 'undated';
        if (date !== brief.date) {
          renameSync(briefPath, join(dataDir, 'archive', `${date}.json`));
        }
      } catch {
        // An unreadable previous brief is not worth refusing to write a good
        // one over. It is about to be replaced either way.
      }
    }

    const tmp = `${briefPath}.${randomUUID().slice(0, 8)}.tmp`;
    writeFileSync(tmp, JSON.stringify(brief, null, 2), 'utf8');
    renameSync(tmp, briefPath);
    return briefPath;
  }

  /**
   * The article behind today's topic, or null.
   *
   * The id is checked rather than trusted. It arrives from `brief.json`, which
   * is written by a model, and it is about to become a path - so anything that
   * is not a plain slug is refused here rather than sanitised further down. A
   * guard at the one place a filename is built is a guard you can actually
   * verify; a sanitiser sprinkled along the way is not.
   *
   * @param {unknown} id
   * @returns {import('../domain/learn.js').Article | null}
   */
  function article(id) {
    if (!isTopicId(id)) {
      return null;
    }
    const path = join(learnDir, `${id}.json`);
    if (!existsSync(path)) {
      return null;
    }
    try {
      return parseArticle(JSON.parse(stripBom(readFileSync(path, 'utf8'))));
    } catch (err) {
      onWarning(`learn/${id}.json could not be read: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  /**
   * Put the rendered page on disk, next to the article it came from.
   *
   * Rewritten every time the button is pressed rather than cached, so a change
   * to the template shows up on this morning's page instead of the next one.
   *
   * @param {string} id
   * @param {string} html
   */
  function writeArticlePage(id, html) {
    if (!isTopicId(id)) {
      throw new Error(`"${String(id)}" is not a usable topic id.`);
    }
    mkdirSync(learnDir, { recursive: true });
    const path = join(learnDir, `${id}.html`);
    writeFileSync(path, html, 'utf8');
    return path;
  }

  /**
   * Record that a candidate was accepted or rejected.
   *
   * Rejections are kept too, and that is the point of the section: a generator
   * whose suggestions are always turned down is a generator with a bad filter,
   * and there is no way to see that if only the yeses are written down.
   *
   * @param {import('../domain/brief.js').Candidate} candidate
   * @param {'accepted' | 'rejected'} verdict
   * @param {number} now
   */
  function confirm(candidate, verdict, now) {
    const record = { at: now, verdict, ...candidate };
    appendFileSync(confirmedPath, `${JSON.stringify(record)}\n`, 'utf8');
    return record;
  }

  /**
   * Everything ever confirmed, skipping any line that is not valid JSON.
   *
   * A truncated last line is the normal failure of an append-only file and
   * costs exactly that line.
   */
  function confirmed() {
    if (!existsSync(confirmedPath)) {
      return [];
    }
    const out = [];
    for (const line of readFileSync(confirmedPath, 'utf8').split('\n')) {
      if (line.trim() === '') {
        continue;
      }
      try {
        out.push(JSON.parse(line));
      } catch {
        onWarning('Skipped an unreadable line in confirmed.jsonl.');
      }
    }
    return out;
  }

  /** Which days are in the archive, newest first. */
  const archived = () =>
    readdirSync(join(dataDir, 'archive'))
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.replace(/\.json$/, ''))
      .sort()
      .reverse();

  return { dataDir, briefPath, confirmedPath, learnDir, read, write, article, writeArticlePage, confirm, confirmed, archived };
}
