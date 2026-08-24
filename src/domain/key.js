/**
 * The Gemini key, and where it is allowed to live.
 *
 * Three places are checked, in this order:
 *
 *   1. `GEMINI_API_KEY` in the environment
 *   2. the file named by `GEMINI_KEY_FILE`
 *   3. `gemini.key` in the data directory
 *
 * The file exists because `setx` does not reach a shell that is already open -
 * so setting the variable "permanently" appears to do nothing until you open a
 * new terminal, which is a confusing first experience for something that is
 * either present or absent. A file is readable the moment it is saved.
 *
 * It also keeps the key out of the registry, where a user environment variable
 * is readable by every process the account runs and survives in backups.
 *
 * ## What this does not do
 *
 * It does not encrypt anything. The file sits in the data directory, which on
 * this machine is inside a synced folder - so the key is on Dropbox's servers
 * and on every machine that folder reaches. For a free AI Studio key with a
 * daily quota and no billing attached that is a reasonable trade, and it is
 * still a trade: set `GEMINI_KEY_FILE` to somewhere unsynced if you would rather
 * not make it.
 *
 * A key is never written by this module, only read. Nothing in Brief should ever
 * put a credential somewhere the user did not choose.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** @param {string} dataDir */
export const keyPath = (dataDir) => join(dataDir, 'gemini.key');

/**
 * @param {string} dataDir
 * @returns {{ key: string, source: string } | null}
 */
export function readKey(dataDir) {
  const fromEnv = process.env.GEMINI_API_KEY;
  if (fromEnv !== undefined && fromEnv.trim() !== '') {
    return { key: fromEnv.trim(), source: 'GEMINI_API_KEY' };
  }

  const named = process.env.GEMINI_KEY_FILE;
  const candidates = [];
  if (named !== undefined && named.trim() !== '') {
    candidates.push({ path: named.trim(), source: 'GEMINI_KEY_FILE' });
  }
  candidates.push({ path: keyPath(dataDir), source: keyPath(dataDir) });

  for (const candidate of candidates) {
    if (!existsSync(candidate.path)) {
      continue;
    }
    // Trimmed, because the overwhelmingly common way to create this file is to
    // paste a key into an editor, and editors add a trailing newline.
    const key = readFileSync(candidate.path, 'utf8').trim();
    if (key !== '') {
      return { key, source: candidate.source };
    }
  }

  return null;
}

/**
 * What to print when there is no key.
 *
 * Spells out that a subscription is not API access, because they are separate
 * products and assuming otherwise is the obvious mistake to make.
 *
 * @param {string} dataDir
 */
export const noKeyMessage = (dataDir) =>
  `No Gemini key.\n\n` +
  `Paste one into:\n  ${keyPath(dataDir)}\n\n` +
  `or set GEMINI_API_KEY, or point GEMINI_KEY_FILE at a file somewhere else.\n\n` +
  `Get one free at https://aistudio.google.com/apikey - it is an AI Studio key\n` +
  `and is NOT the same thing as a Gemini subscription. A subscription grants no\n` +
  `API access at all; they are separate products.`;
