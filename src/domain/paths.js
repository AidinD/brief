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
 * The data directory for a *script*, which has no Electron to ask.
 *
 * There is deliberately no fallback. An earlier version passed `process.cwd()`
 * as one, and the first time anyone ran a script from the repo without the
 * variable set it wrote `outbound.json` - a file listing internal project names
 * and private work - straight into the git tree. It was untracked, unignored,
 * and one `git add -A` from being published.
 *
 * A script that cannot tell where the data lives must stop, not guess. Guessing
 * "here" is the worst available answer, because "here" is usually a repository.
 *
 * @returns {string}
 */
export function requireDataDir() {
  const dir = process.env.BRIEF_DATA_DIR;
  if (dir === undefined || dir.trim() === '') {
    throw new Error(
      'BRIEF_DATA_DIR is not set.\n\n' +
        'Scripts will not guess a data directory: the obvious guess is the current\n' +
        'directory, which is this repository, and these files hold private work.\n\n' +
        'PowerShell, for this shell only:  $env:BRIEF_DATA_DIR = "D:\\Dropbox\\brief"\n' +
        'Permanently (new shells only):    setx BRIEF_DATA_DIR "D:\\Dropbox\\brief"'
    );
  }
  return dir.trim();
}

/**
 * Jot's board, if it is installed. Brief reads categories and open work from it
 * to decide what "relevant" means.
 */
export const resolveJotDir = () =>
  resolve(process.env.JOT_DATA_DIR, join(homedir(), 'AppData', 'Roaming', 'jot'));

/** Tend's store, same idea: the role map says what you are responsible for. */
export const resolveTendDir = () =>
  resolve(process.env.TEND_DATA_DIR, join(homedir(), 'AppData', 'Roaming', 'tend'));
