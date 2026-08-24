import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  readInterests,
  removeInterest,
  searchable,
  setInterest,
  weakness
} from '../src/service/interests.js'
import * as api from '../src/service/api.js'

/**
 * @template T
 * @param {(dir: string) => T} body
 * @returns {T}
 */
function scratch(body) {
  const dir = mkdtempSync(join(tmpdir(), 'brief-int-'))
  try {
    return body(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('an interest you typed is searched for without a second confirmation', () => {
  scratch((dir) => {
    // The asymmetry with holdings is the point: writing "Unity" into a box
    // labelled "what should Brief look for" IS the disclosure decision. Asking
    // again is how people learn to click through consent screens.
    setInterest(dir, { term: 'Unity' })
    assert.deepEqual(searchable(dir), [{ term: 'Unity', why: undefined }])
  })
})

test('an interest can be kept but switched off', () => {
  scratch((dir) => {
    setInterest(dir, { term: 'Unity' })
    setInterest(dir, { term: 'Unity', send: false })
    assert.deepEqual(searchable(dir), [])
    assert.equal(readInterests(dir).length, 1, 'still on the list, just not searched')
  })
})

test('the why travels with the term, because it is what makes triage possible', () => {
  scratch((dir) => {
    setInterest(dir, { term: 'Unity', why: 'evaluating it as an engine for short-form playables' })
    assert.deepEqual(searchable(dir), [
      { term: 'Unity', why: 'evaluating it as an engine for short-form playables' }
    ])
  })
})

test('terms are matched case-insensitively, so one term cannot become two', () => {
  scratch((dir) => {
    setInterest(dir, { term: 'Unity', why: 'first' })
    setInterest(dir, { term: 'unity', why: 'second' })
    const all = readInterests(dir)
    assert.equal(all.length, 1)
    assert.equal(all[0].why, 'second')
    assert.equal(all[0].term, 'Unity', 'the original spelling is kept')
  })
})

test('removing an interest removes exactly one', () => {
  scratch((dir) => {
    setInterest(dir, { term: 'Unity' })
    setInterest(dir, { term: 'Roblox' })
    removeInterest(dir, 'unity')
    assert.deepEqual(
      readInterests(dir).map((i) => i.term),
      ['Roblox']
    )
  })
})

test('an interest with no term is refused rather than written blank', () => {
  scratch((dir) => {
    assert.throws(() => setInterest(dir, { term: '  ' }), /needs a term/)
    assert.deepEqual(readInterests(dir), [])
  })
})

test('a hand-written file with no send field is treated as yes', () => {
  scratch((dir) => {
    // Somebody editing the JSON directly and omitting the flag obviously means
    // "search for this". Defaulting to off would silently ignore their file.
    writeFileSync(join(dir, 'interests.json'), JSON.stringify({ interests: [{ term: 'Roblox' }] }), 'utf8')
    assert.deepEqual(searchable(dir), [{ term: 'Roblox', why: undefined }])
  })
})

test('a corrupt interests file searches for nothing rather than throwing', () => {
  scratch((dir) => {
    writeFileSync(join(dir, 'interests.json'), '{ broken', 'utf8')
    assert.deepEqual(readInterests(dir), [])
  })
})

/* ------------------------------------------------------------- advice -- */

test('a broad abstraction is flagged, because nothing happens to it in 48 hours', () => {
  // There is no news about leadership; there are opinion pieces about it. A
  // daily search on the word produces exactly the unread feed this app exists
  // to avoid, and finding that out should not take a week.
  assert.match(String(weakness({ term: 'ledarskap' })), /48 hours/)
  assert.match(String(weakness({ term: 'leadership' })), /48 hours/)
  assert.match(String(weakness({ term: 'politik' })), /48 hours/)
})

test('a single short word is flagged as ambiguous', () => {
  assert.match(String(weakness({ term: 'Unity' })), /several things/)
})

test('a why silences the advice, because a why is the fix', () => {
  assert.equal(weakness({ term: 'ledarskap', why: 'ladders and review models being published' }), null)
  assert.equal(weakness({ term: 'Unity', why: 'evaluating it as an engine' }), null)
})

test('a specific phrase needs no advice', () => {
  assert.equal(weakness({ term: 'engineering ladders published by game studios' }), null)
})

test('the window gets the advice with the row, not computed in the renderer', () => {
  scratch((dir) => {
    setInterest(dir, { term: 'ledarskap' })
    setInterest(dir, { term: 'Roblox monetisation changes', why: 'Meteor Run revenue model' })

    const state = api.interests({ dataDir: dir })
    const flagged = state.interests.find((i) => i.term === 'ledarskap')
    const fine = state.interests.find((i) => i.term === 'Roblox monetisation changes')

    assert.ok(flagged?.advice, 'the broad one carries advice')
    assert.equal(fine?.advice, null, 'the specific one does not')
    assert.equal(state.searching.length, 2, 'advice does not stop it being searched')
  })
})
