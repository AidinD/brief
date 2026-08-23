/**
 * Where the data lives.
 *
 * `BRIEF_DATA_DIR` wins if it is set, exactly as Jot, Nib and Tend do it. That
 * is how the two machines share one folder through Dropbox, and how a test run
 * points at a scratch directory instead of the real one.
 *
 * Brief also *reads* two neighbours - Jot's board and Tend's store - to work out
 * what you are holding. Those are read-only and located the same way, by their
 * own environment variables, so nothing here has to guess at a sibling's
 * install.
 */

import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * @param {string | undefined} override
 * @param {string} fallback
 * @returns {{ dir: string, source: string }}
 */
function resolve(override, fallback) {
  if (override !== undefined && override.trim() !== '') {
    return { dir: override.trim(), source: 'environment' };
  }
  return { dir: fallback, source: 'default' };
}

/**
 * Brief's own directory: `brief.json`, `archive/`, `confirmed.jsonl`.
 *
 * @param {string} userData Electron's userData path. Passed in rather than
 *   imported so this file stays testable without electron.
 */
export const resolveDataDir = (userData) => resolve(process.env.BRIEF_DATA_DIR, userData);

/**
 * Jot's board, if it is installed. Brief reads categories and open work from it
 * to decide what "relevant" means.
 */
export const resolveJotDir = () =>
  resolve(process.env.JOT_DATA_DIR, join(homedir(), 'AppData', 'Roaming', 'jot'));

/** Tend's store, same idea: the role map says what you are responsible for. */
export const resolveTendDir = () =>
  resolve(process.env.TEND_DATA_DIR, join(homedir(), 'AppData', 'Roaming', 'tend'));
