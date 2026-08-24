import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { emptyBrief } from '../src/domain/brief.js'
import { openStore } from '../src/storage/store.js'
import * as api from '../src/service/api.js'

const NOW = Date.UTC(2026, 7, 23, 9, 0, 0)

/**
 * A scratch data directory that cleans itself up.
 *
 * @template T
 * @param {(dir: string) => T} body
 * @returns {T}
 */
function scratch(body) {
  const dir = mkdtempSync(join(tmpdir(), 'brief-'))
  try {
    return body(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('a missing brief reads as empty rather than as an error', () => {
  scratch((dir) => {
    const store = openStore({ dataDir: dir })
    const state = store.read('2026-08-23', NOW)
    assert.equal(state.missing, true)
    assert.deepEqual(state.brief.world.needsYou, [])
    assert.deepEqual(state.problems, [])
  })
})

test('unreadable JSON warns and still gives the window something to draw', () => {
  scratch((dir) => {
    writeFileSync(join(dir, 'brief.json'), '{ this is not json')
    /** @type {string[]} */
    const warnings = []
    const store = openStore({ dataDir: dir, onWarning: (m) => warnings.push(m) })
    const state = store.read('2026-08-23', NOW)
    assert.equal(state.missing, true)
    assert.equal(warnings.length, 1)
    assert.match(warnings[0], /could not be read/)
  })
})

test('a BOM does not stop the file being read', () => {
  scratch((dir) => {
    const brief = emptyBrief('2026-08-23', NOW)
    brief.week.summary = 'Fyra dagar på sviten'
    writeFileSync(join(dir, 'brief.json'), `﻿${JSON.stringify(brief)}`, 'utf8')
    const store = openStore({ dataDir: dir })
    assert.equal(store.read('2026-08-23', NOW).brief.week.summary, 'Fyra dagar på sviten')
  })
})

test('writing a brief for a new day archives the old one', () => {
  scratch((dir) => {
    const store = openStore({ dataDir: dir })
    store.write(emptyBrief('2026-08-22', NOW))
    store.write(emptyBrief('2026-08-23', NOW))

    assert.deepEqual(store.archived(), ['2026-08-22'])
    assert.equal(store.read('2026-08-23', NOW).brief.date, '2026-08-23')
  })
})

test('rewriting the same day replaces it without filling the archive', () => {
  scratch((dir) => {
    const store = openStore({ dataDir: dir })
    store.write(emptyBrief('2026-08-23', NOW))
    store.write(emptyBrief('2026-08-23', NOW))
    assert.deepEqual(store.archived(), [])
  })
})

test('a brief is written whole, never half', () => {
  scratch((dir) => {
    // The window watches this file. Writing in place means a watcher can read a
    // half-written brief and draw it; the temporary file and rename are what
    // make that impossible.
    const store = openStore({ dataDir: dir })
    const path = store.write(emptyBrief('2026-08-23', NOW))
    assert.doesNotThrow(() => JSON.parse(readFileSync(path, 'utf8')))
    assert.equal(existsSync(`${path}.tmp`), false)
  })
})

test('a rejection is recorded, not just an acceptance', () => {
  scratch((dir) => {
    const store = openStore({ dataDir: dir })
    const brief = emptyBrief('2026-08-23', NOW)
    brief.confirm = [
      { id: 'a', kind: 'decision', text: 'Keep this one' },
      { id: 'b', kind: 'story', text: 'Not this one' }
    ]
    store.write(brief)

    // Through the service layer, because that is what the window calls.
    const yes = api.answer(store, 'a', 'accepted', NOW)
    const no = api.answer(store, 'b', 'rejected', NOW)

    assert.equal(yes.verdict, 'accepted')
    assert.equal(no.verdict, 'rejected')
    // A yes says where it was filed, so the window can tell you. A no has
    // nowhere to be filed and must not claim otherwise.
    assert.match(String(yes.keptAt), /kept\.md$/)
    assert.equal(no.keptAt, null)

    // Both, deliberately. A generator whose suggestions are always turned down
    // has a bad filter, and there is no way to see that from the yeses alone.
    assert.deepEqual(api.answered(store), { a: 'accepted', b: 'rejected' })
    assert.equal(store.confirmed().length, 2)
  })
})

test('keeping something writes it somewhere a person would read', () => {
  scratch((dir) => {
    const store = openStore({ dataDir: dir })
    const brief = emptyBrief('2026-08-23', NOW)
    brief.confirm = [
      { id: 'a', kind: 'story', text: 'Worth keeping', why: 'because', evidence: 'helm' },
      { id: 'b', kind: 'decision', text: 'Not worth keeping' }
    ]
    store.write(brief)

    api.answer(store, 'a', 'accepted', NOW)
    api.answer(store, 'b', 'rejected', NOW)

    // A "Keep it" button whose only effect is a line in a log is a button that
    // does nothing.
    const kept = readFileSync(join(dir, 'kept.md'), 'utf8')
    assert.match(kept, /Worth keeping/)
    assert.match(kept, /because/)
    assert.equal(/Not worth keeping/.test(kept), false, 'a rejection is not a keepsake')
  })
})

test('keeping the same thing twice files it once', () => {
  scratch((dir) => {
    const store = openStore({ dataDir: dir })
    const brief = emptyBrief('2026-08-23', NOW)
    brief.confirm = [{ id: 'a', kind: 'story', text: 'Worth keeping' }]
    store.write(brief)

    api.answer(store, 'a', 'accepted', NOW)
    api.answer(store, 'a', 'accepted', NOW)

    // A double click is a double click. Two copies and you cannot tell later
    // which one you meant.
    const kept = readFileSync(join(dir, 'kept.md'), 'utf8')
    assert.equal(kept.match(/Worth keeping/g)?.length, 1)
  })
})

test('answering leaves the brief itself untouched', () => {
  scratch((dir) => {
    const store = openStore({ dataDir: dir })
    const brief = emptyBrief('2026-08-23', NOW)
    brief.confirm = [{ id: 'a', kind: 'decision', text: 'Keep this one' }]
    store.write(brief)
    api.answer(store, 'a', 'accepted', NOW)

    // The brief is the record of what was *proposed*. Editing it away would
    // destroy the only evidence of what the generator suggested.
    assert.equal(store.read('2026-08-23', NOW).brief.confirm.length, 1)
  })
})

test('answering an id that is not in the brief is refused, not invented', () => {
  scratch((dir) => {
    const store = openStore({ dataDir: dir })
    store.write(emptyBrief('2026-08-23', NOW))
    const result = api.answer(store, 'ghost', 'accepted', NOW)
    assert.match(String(result.error), /ghost/)
    assert.deepEqual(store.confirmed(), [])
  })
})

test('a truncated last line costs one record, not the file', () => {
  scratch((dir) => {
    /** @type {string[]} */
    const warnings = []
    const store = openStore({ dataDir: dir, onWarning: (m) => warnings.push(m) })
    writeFileSync(
      join(dir, 'confirmed.jsonl'),
      `${JSON.stringify({ id: 'a', verdict: 'accepted' })}\n{"id":"b","verd`,
      'utf8'
    )
    assert.equal(store.confirmed().length, 1)
    assert.equal(warnings.length, 1)
  })
})
