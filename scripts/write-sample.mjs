#!/usr/bin/env node
/**
 * Write a sample brief, so the window can be looked at without a model.
 *
 * Also the readable specification. If you are writing a generator - a scheduled
 * session, another tool - this is the shape it has to produce, and
 * `docs/format.md` explains each field.
 *
 * It refuses to overwrite a real brief unless told to, because the obvious way
 * to lose this morning's actual brief is to run the sample writer while looking
 * at it.
 *
 *   node scripts/write-sample.mjs [--force]
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { localDate } from '../src/domain/time.js';
import { openStore } from '../src/storage/store.js';

const dataDir = process.env.BRIEF_DATA_DIR;
if (dataDir === undefined || dataDir.trim() === '') {
  console.error('Set BRIEF_DATA_DIR to the directory the sample should be written into.');
  process.exit(1);
}

const force = process.argv.includes('--force');
if (existsSync(join(dataDir, 'brief.json')) && !force) {
  console.error(`${join(dataDir, 'brief.json')} already exists. Pass --force to replace it.`);
  process.exit(1);
}

const now = Date.now();
const store = openStore({ dataDir });

/** @type {import('../src/domain/brief.js').Brief} */
const brief = {
  version: 1,
  date: localDate(now),
  generatedAt: now,
  world: {
    needsYou: [
      {
        id: 'w1',
        headline: 'Roblox is changing how engagement-based payouts are calculated from October',
        why: 'The change lands on titles that are already live, so it is a number in a plan rather than a thing to read about later.',
        anchor: 'Meteor Run is on your board',
        sources: [{ title: 'Roblox developer forum', url: 'https://devforum.roblox.com/' }]
      },
      {
        id: 'w2',
        headline: 'Sweden raises the ceiling for the R&D payroll deduction',
        why: 'It applies to the current year, which means it is a conversation with finance this month rather than at the next budget.',
        anchor: 'Work',
        sources: [{ title: 'Skatteverket', url: 'https://www.skatteverket.se/' }]
      }
    ],
    worthKnowing: [
      {
        id: 'w3',
        headline: 'Electron 34 moves to Chromium 132 and drops Windows 10 1809',
        why: 'Nothing to do now. Worth knowing before the next dependency bump goes in without reading the notes.',
        anchor: 'The suite',
        sources: [{ title: 'Electron releases', url: 'https://www.electronjs.org/blog' }]
      },
      {
        id: 'w4',
        headline: 'Two more studios publish engineering ladders with an explicit staff-versus-lead split',
        why: 'Useful shape to compare against; no action.',
        anchor: 'Role map'
      }
    ]
  },
  behind: [
    {
      id: 'b1',
      headline: 'The producer feedback round has never been run for four of the people you carry',
      why: 'The target is every 90 days. The oldest is 62 weeks past it, the youngest 48.',
      anchor: 'Tend: feedback rounds'
    },
    {
      id: 'b2',
      headline: 'You have not spoken to six of nine people this month',
      why: 'Contact is concentrated on the same three.',
      anchor: 'Tend: attention'
    }
  ],
  week: {
    summary:
      'Four days on the suite and one on the board. The shared layer landed and two apps now depend on it, which is the first week that work paid for itself rather than costing.',
    moments: [
      { id: 'm1', when: 'Monday', text: 'Pinned todos to the desktop; Jot 1.5.36 shipped.' },
      { id: 'm2', when: 'Wednesday', text: 'Found seven screenshots of real work in a public repo and rewrote 734 commits.' },
      { id: 'm3', when: 'Friday', text: 'keel went from an idea to two apps depending on it.' }
    ]
  },
  confirm: [
    {
      id: 'c1',
      kind: 'decision',
      text: 'Gemini is allowed to see the world half of a brief. Claude keeps the half that reads your notes.',
      why: 'It reads like a cost decision and is not one - the notes name colleagues.',
      evidence: 'Decided while scoping Brief, 2026-08-23'
    },
    {
      id: 'c2',
      kind: 'story',
      text: 'Caught a data leak in a public repo, traced it to a harness that had been fixed a month earlier, and rewrote the history.',
      why: 'The point of the story is that fixing the bug was not the same as removing what it produced.',
      evidence: 'helm, 2026-08-23'
    }
  ],
  lesson: {
    id: 'note-sample',
    title: '1.1 · Kritisera inte - fråga i stället',
    line: 'Kritik får nästan alltid mottagaren att försvara sitt beslut i stället för att ompröva det. Den vinner argumentet och förlorar personen.',
    source: 'How to Win Friends and Influence People',
    why: 'Fyra feedbackrundor väntar'
  },
  notes: ['Sample brief. Written by scripts/write-sample.mjs, not by a model.']
};

const path = store.write(brief);
console.log(`Wrote ${path}`);
