#!/usr/bin/env node
/**
 * Write today's brief, unless it is already written.
 *
 * A thin wrapper: the run itself lives in `src/service/run.js`, so this and the
 * button in the window execute the same code rather than two things that are
 * meant to agree.
 *
 * This is what the scheduled task calls. `npm run schedule` prints the
 * PowerShell that registers it.
 *
 *   node scripts/morning.mjs           nothing if today's brief exists
 *   node scripts/morning.mjs --force   replace today's brief
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { requireDataDir, resolveJotDir, resolveNibDir } from '../src/domain/paths.js';
import { runMorning } from '../src/service/run.js';

const repoDir = join(dirname(fileURLToPath(import.meta.url)), '..');

const result = await runMorning({
  dataDir: requireDataDir(),
  jotDir: resolveJotDir().dir,
  nibDir: resolveNibDir().dir,
  repoDir,
  force: process.argv.includes('--force'),
  onReport: (stage, message) => console.log(`${stage}: ${message}`)
});

process.exit(result.ok ? 0 : 1);
