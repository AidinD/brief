import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { MODELS, checkProvenance } from '../src/domain/models.js'
import { emptyBrief } from '../src/domain/brief.js'
import { openStore } from '../src/storage/store.js'
import * as api from '../src/service/api.js'

const NOW = Date.now()

/**
 * @template T
 * @param {(dir: string) => T} body
 * @returns {T}
 */
function scratch(body) {
  const dir = mkdtempSync(join(tmpdir(), 'brief-models-'))
  try {
    return body(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('the cheap tier is on the fetch and the good one is on the judgement', () => {
  // The expensive mistake is the other way round, and it is the one that happens
  // by accident: a session inherits whatever model it was started on.
  assert.match(MODELS.fetch.id, /haiku/)
  assert.match(MODELS.judge.id, /sonnet|opus|fable/)
  assert.equal(/opus/.test(MODELS.fetch.id), false, 'never the largest model on volume work')
})

test('a matching family passes, dated snapshot and all', () => {
  assert.equal(checkProvenance('claude-haiku-4-5-20251001', 'fetch').ok, true)
  assert.equal(checkProvenance('claude-haiku-4-5', 'fetch').ok, true)
})

test('the wrong tier is named, not merely flagged', () => {
  const result = checkProvenance('claude-opus-5', 'fetch')
  assert.equal(result.ok, false)
  // "Wrong model" is not actionable. "Opus did the fetching" is.
  assert.match(String(result.note), /opus did the fetch/i)
  assert.equal(result.ran, 'claude-opus-5')
  assert.match(result.expected, /haiku/)
})

test('nothing recorded is a failure, not a pass', () => {
  // The whole point: a configured model is a statement of intent and says
  // nothing about what ran. Absent provenance must not read as compliant.
  for (const missing of [undefined, '', '   ']) {
    const result = checkProvenance(missing, 'judge')
    assert.equal(result.ok, false)
    assert.equal(result.ran, null)
    assert.match(String(result.note), /no way to tell/)
  }
})

test('a brief with the right provenance raises nothing in the window', () => {
  scratch((dir) => {
    const store = openStore({ dataDir: dir })
    const brief = emptyBrief('2026-08-24', NOW)
    brief.provenance = { fetch: MODELS.fetch.id, judge: MODELS.judge.id }
    store.write(brief)

    assert.deepEqual(api.today(store, NOW).models, [], 'silent when it is as intended')
  })
})

test('a brief fetched by the expensive model says so in the window', () => {
  scratch((dir) => {
    const store = openStore({ dataDir: dir })
    const brief = emptyBrief('2026-08-24', NOW)
    brief.provenance = { fetch: 'claude-opus-5', judge: MODELS.judge.id }
    store.write(brief)

    const flagged = api.today(store, NOW).models
    assert.equal(flagged.length, 1)
    assert.match(String(flagged[0].note), /opus did the fetch/i)
  })
})

test('a brief that records nothing keeps recording nothing through a round trip', () => {
  scratch((dir) => {
    // parseBrief must not invent a reassuring default here. "There is no way to
    // tell" is the honest answer and has to survive being read back.
    const store = openStore({ dataDir: dir })
    store.write(emptyBrief('2026-08-24', NOW))

    const state = api.today(store, NOW)
    assert.equal(state.brief.provenance?.fetch, undefined)
    assert.equal(state.models.length, 2, 'both halves unaccounted for')
  })
})

test('a missing brief does not complain about models it never had', () => {
  scratch((dir) => {
    const store = openStore({ dataDir: dir })
    assert.deepEqual(api.today(store, NOW).models, [])
  })
})
