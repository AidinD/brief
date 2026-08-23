#!/usr/bin/env node
/**
 * Drive the real app, without touching the mouse.
 *
 * Talks to the running renderer over the Chrome DevTools Protocol: it reads the
 * DOM and dispatches real clicks on elements it found by selector. Moving the
 * pointer would fight whoever is using the machine, steal focus, and every
 * coordinate would be a guess that goes stale the moment a layout shifts.
 *
 * Two rules, both learned the hard way in the sibling apps:
 *
 *   It launches its OWN Electron instance and kills only that PID. Never by
 *   name - other Electron apps are often running and a broad kill closes
 *   whatever someone is working in.
 *
 *   It always points BRIEF_DATA_DIR at a scratch folder. A brief is assembled
 *   out of real work and, in the confirm section, real colleagues.
 *
 *   node scripts/e2e-app.mjs [--keep] [--packaged]
 *
 * `--packaged` runs against dist/win-unpacked/Brief.exe. Worth its own mode:
 * Brief ships its source unbuilt, so the packaged app resolves the preload, the
 * renderer and keel from inside an asar archive, and a path that works in
 * development can fail there with nothing but a blank window.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const PORT = 9413;
const keep = process.argv.includes('--keep');
const packaged = process.argv.includes('--packaged');
const scratch = mkdtempSync(join(tmpdir(), 'brief-app-'));
const jotScratch = mkdtempSync(join(tmpdir(), 'brief-app-jot-'));

let failures = 0;
let checks = 0;

/** @param {number} ms */
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** @param {string} label @param {() => void} fn */
function check(label, fn) {
  checks += 1;
  try {
    fn();
    console.log(`  ok   ${label}`);
  } catch (err) {
    failures += 1;
    console.error(`  FAIL ${label}`);
    console.error(`       ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** @param {string} label */
function step(label) {
  console.log(`\n  — ${label}`);
}

async function findPage() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = /** @type {any[]} */ (await response.json());
      const page = targets.find((t) => t.type === 'page');
      if (page) {
        return page;
      }
    } catch {
      // Port not up yet.
    }
    await sleep(250);
  }
  throw new Error('The renderer never appeared on the debugging port');
}

/** @param {string} url */
async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((done, fail) => {
    socket.addEventListener('open', () => done(undefined), { once: true });
    socket.addEventListener('error', () => fail(new Error('CDP socket failed')), { once: true });
  });

  let nextId = 1;
  /** @type {Map<number, { done: (v: any) => void, fail: (e: Error) => void }>} */
  const pending = new Map();

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    const waiter = pending.get(message.id);
    if (!waiter) {
      return;
    }
    pending.delete(message.id);
    if (message.error) {
      waiter.fail(new Error(message.error.message));
    } else {
      waiter.done(message.result);
    }
  });

  /** @param {string} method @param {object} [params] */
  const send = (method, params = {}) =>
    new Promise((done, fail) => {
      const id = nextId++;
      pending.set(id, { done, fail });
      socket.send(JSON.stringify({ id, method, params }));
    });

  /** @param {string} expression */
  const evaluate = async (expression) => {
    const result = /** @type {any} */ (
      await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    );
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? 'page threw');
    }
    return result.result.value;
  };

  /** @param {string} expression @param {string} label */
  const waitFor = async (expression, label) => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (await evaluate(expression)) {
        return;
      }
      await sleep(150);
    }
    throw new Error(`Timed out waiting for ${label}`);
  };

  /** @param {string} selector */
  const click = async (selector) => {
    const clicked = await evaluate(
      `(() => { const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) { return false; } el.click(); return true; })()`
    );
    if (!clicked) {
      throw new Error(`Nothing matched ${selector}`);
    }
    await sleep(250);
  };

  const text = async (/** @type {string} */ selector) =>
    String(
      await evaluate(`(document.querySelector(${JSON.stringify(selector)}) || {}).textContent || ""`)
    );

  const texts = async (/** @type {string} */ selector) =>
    /** @type {string[]} */ (
      JSON.parse(
        String(
          await evaluate(
            `JSON.stringify([...document.querySelectorAll(${JSON.stringify(selector)})].map(n => n.textContent))`
          )
        )
      )
    );

  const count = async (/** @type {string} */ selector) =>
    Number(await evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`));

  return { evaluate, waitFor, click, text, texts, count, close: () => socket.close() };
}

/**
 * A brief with one of everything, written straight to the scratch directory.
 *
 * @param {string} date @param {Record<string, any>} [extra]
 */
function writeBrief(date, extra = {}) {
  const brief = {
    version: 1,
    date,
    generatedAt: Date.now(),
    world: {
      needsYou: [
        {
          id: 'n1',
          headline: 'Something you have to answer',
          why: 'It lands on work already on the board.',
          anchor: 'Northwind',
          sources: [{ title: 'Primary source', url: 'https://example.com/one' }]
        }
      ],
      worthKnowing: [{ id: 'k1', headline: 'Något värt att veta med å, ä och ö', why: 'Ingen åtgärd.' }]
    },
    week: {
      summary: 'En vecka som mest handlade om sviten.',
      moments: [{ id: 'm1', when: 'Monday', text: 'Släppte en version.' }]
    },
    confirm: [
      { id: 'c1', kind: 'decision', text: 'A decision worth logging', why: 'Because it will be forgotten.' },
      { id: 'c2', kind: 'story', text: 'A story worth keeping' }
    ],
    ...extra
  };
  writeFileSync(join(scratch, 'brief.json'), JSON.stringify(brief, null, 2), 'utf8');
  return brief;
}

/** Today, in local time - the same way the app computes it. */
function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

console.log(`Scratch data: ${scratch}`);
console.log(`Scratch Jot:  ${jotScratch}\n`);

// A small board, so the holdings reader has something real to read.
writeFileSync(
  join(jotScratch, 'todos.json'),
  JSON.stringify({
    categories: [{ id: 'c1', name: 'Northwind', domain: 'work' }],
    todos: [{ id: 't1', text: 'Ship the thing', status: 'in-progress', categoryId: 'c1' }]
  }),
  'utf8'
);

const devElectron =
  process.platform === 'win32'
    ? join(root, 'node_modules', 'electron', 'dist', 'electron.exe')
    : join(root, 'node_modules', '.bin', 'electron');
const packagedExe = join(root, 'dist', 'win-unpacked', 'Brief.exe');

const exe = packaged ? packagedExe : devElectron;
if (packaged && !existsSync(exe)) {
  console.error(`No packaged build at ${exe}. Run \`npm run package\` first.`);
  process.exit(1);
}

const args = packaged ? [`--remote-debugging-port=${PORT}`] : [root, `--remote-debugging-port=${PORT}`];
console.log(packaged ? 'Mode: packaged build' : 'Mode: development');

const child = spawn(exe, args, {
  cwd: root,
  env: {
    ...process.env,
    BRIEF_DATA_DIR: scratch,
    JOT_DATA_DIR: jotScratch,
    ELECTRON_ENABLE_LOGGING: '0'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

/** @type {string[]} */
const mainOutput = [];
child.stdout?.on('data', (d) => mainOutput.push(String(d)));
child.stderr?.on('data', (d) => mainOutput.push(String(d)));

/** @type {Awaited<ReturnType<typeof connect>> | null} */
let page = null;

try {
  const target = await findPage();
  page = await connect(target.webSocketDebuggerUrl);
  // Null-safe: the page target exists on the debugging port before the document
  // does, so the first few polls run against an empty document.
  await page.waitFor("((document.querySelector('#page') || {}).textContent || '').trim() !== ''", 'the first paint');
  console.log('App is up.');

  /* ------------------------------------------------------- no brief -- */

  step('Before there is a brief');

  check('uses the scratch data directory, not the real one', () => {
    if (!mainOutput.join('').includes(scratch)) {
      throw new Error(`main never reported the scratch dir: ${mainOutput.join('').slice(0, 300)}`);
    }
  });

  const empty = await page.text('.empty');
  check('says nothing is wrong, because nothing is', () => {
    if (!/No brief for today/.test(empty)) {
      throw new Error(`expected the empty state, saw "${empty.slice(0, 200)}"`);
    }
    if (/error|failed|problem/i.test(empty)) {
      throw new Error(`the empty state reads as a fault: ${empty.slice(0, 200)}`);
    }
  });

  /* ------------------------------------------------- a brief appears -- */

  step('A brief appears while the window is open');

  // The whole integration story: something else writes a file, the window
  // notices. No refresh button, no port, nothing to authenticate against.
  writeBrief(todayLocal());
  await page.waitFor("document.querySelector('.item') !== null", 'the brief to arrive on its own');

  const headlines = await page.texts('.item-headline');
  check('both sections rendered, and Swedish kept its å, ä and ö', () => {
    if (headlines.length !== 2) {
      throw new Error(`expected two world items, saw ${headlines.length}`);
    }
    if (!headlines.some((h) => /å, ä och ö/.test(h))) {
      throw new Error(`Swedish characters were mangled: ${headlines.join(' | ')}`);
    }
  });

  const needs = await page.count('.item.needs');
  check('only the needs-you item carries the emphasis', () => {
    if (needs !== 1) {
      throw new Error(`expected exactly one emphasised item, saw ${needs}`);
    }
  });

  const end = await page.text('.end-note');
  check('and the brief ends, visibly', () => {
    if (!/That is the brief/.test(end)) {
      throw new Error(`no bottom: "${end}"`);
    }
  });

  const badges = await page.count('.badge, .unread, [data-count]');
  check('nothing on the page counts unread things at you', () => {
    if (badges !== 0) {
      throw new Error(`found ${badges} counter-ish elements`);
    }
  });

  /* --------------------------------------------------------- confirm -- */

  step('Confirming things');

  await page.click('[data-answer="accepted"]');
  await page.waitFor("document.querySelector('.candidate.answered') !== null", 'the answer to land');

  const verdict = await page.text('.verdict');
  check('answering a candidate sticks, and says which way it went', () => {
    if (!/kept/.test(verdict)) {
      throw new Error(`expected "kept", saw "${verdict}"`);
    }
  });

  const remaining = await page.count('.candidate');
  check('and the candidate stays on the page rather than vanishing', () => {
    // The brief is the record of what was proposed. Removing an answered item
    // would destroy the evidence of what the generator suggested.
    if (remaining !== 2) {
      throw new Error(`expected both candidates still listed, saw ${remaining}`);
    }
  });

  /* ----------------------------------------------------------- stale -- */

  step('A brief from another day');

  writeBrief('2020-01-02');
  await page.waitFor("document.querySelector('.problems') !== null", 'the stale warning');

  const stale = await page.text('.problems');
  check('says so, and names the year, so it cannot be mistaken for this January', () => {
    if (!/2 January 2020/.test(stale)) {
      throw new Error(`expected the old date named in full, saw "${stale.slice(0, 200)}"`);
    }
  });

  /* -------------------------------------------------------- overflow -- */

  step('A brief that is over its limit');

  writeBrief(todayLocal(), {
    world: {
      needsYou: Array.from({ length: 9 }, (_, i) => ({ id: `x${i}`, headline: `Item ${i}`, why: '' })),
      worthKnowing: []
    }
  });
  await page.waitFor(
    "!!document.querySelector('.problems') && /did not make it/.test(document.querySelector('.problems').textContent)",
    'the overflow note'
  );

  const overflow = await page.text('.problems');
  const shown = await page.count('.item');
  check('cuts it and says what was cut, rather than scrolling further', () => {
    if (shown !== 5) {
      throw new Error(`expected the cap of 5 items, saw ${shown}`);
    }
    if (!/4 from needs you/.test(overflow)) {
      throw new Error(`the overflow was not reported: "${overflow.slice(0, 200)}"`);
    }
  });

  /* --------------------------------------------------- window chrome -- */

  step('The title bar buttons');

  // These come from keel rather than from Brief's own operation whitelist,
  // which means the preload has to resolve a bare specifier out of node_modules
  // - and in the packaged app, out of an asar archive. A resolution failure
  // there is silent from the outside: the buttons simply stop doing anything.
  const missing = JSON.parse(
    String(
      await page.evaluate(
        "JSON.stringify(['minimizeWindow','toggleMaximizeWindow','closeWindow'].filter((k) => typeof window.brief[k] !== 'function'))"
      )
    )
  );
  check('the window controls reached the renderer from keel', () => {
    if (missing.length > 0) {
      throw new Error(`the preload did not expose: ${missing.join(', ')}`);
    }
  });

  const before = await page.evaluate('window.outerWidth');
  await page.click('[data-window="maximize"]');
  await sleep(400);
  const maximised = await page.evaluate('window.outerWidth');
  await page.click('[data-window="maximize"]');
  await sleep(400);
  const restored = await page.evaluate('window.outerWidth');

  check('clicking maximise actually resizes the window, and again restores it', () => {
    if (!(Number(maximised) > Number(before))) {
      throw new Error(`width went ${before} -> ${maximised}; the click did not reach main`);
    }
    if (Number(restored) !== Number(before)) {
      throw new Error(`width came back as ${restored}, not ${before}`);
    }
  });

  /* ------------------------------------------------------------- end -- */

  step('Finishing up');

  const rendererErrors = await page.evaluate("JSON.stringify(window.__errors ?? ['__errors missing'])");
  check('no uncaught renderer errors anywhere in that', () => {
    const list = JSON.parse(String(rendererErrors));
    if (list.length > 0) {
      throw new Error(list.join('; '));
    }
  });
} catch (err) {
  failures += 1;
  console.error(`\nHarness failed: ${err instanceof Error ? err.message : String(err)}`);
  if (mainOutput.length) {
    console.error(`\nApp output:\n${mainOutput.join('').slice(0, 2000)}`);
  }
} finally {
  page?.close();
  if (!keep) {
    // Only this PID. Never by name.
    child.kill();
    await sleep(400);
    rmSync(scratch, { recursive: true, force: true });
    rmSync(jotScratch, { recursive: true, force: true });
  } else {
    console.log(`\nLeft running (pid ${child.pid}), data in ${scratch}`);
  }
}

console.log(
  failures === 0 ? `\nAll ${checks} app checks passed.` : `\n${failures} of ${checks} check(s) failed.`
);
process.exit(failures === 0 ? 0 : 1);
