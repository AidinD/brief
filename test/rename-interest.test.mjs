import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { renameInterest, readInterests, setInterest } from '../src/service/interests.js'

/*
 * The window let you edit an interest's `why` but not its wording, so fixing a
 * typo meant removing the interest and adding it again - which threw away the
 * `why` and reset the send flag. The sentence is the part that makes an interest
 * work, so the cost of a rename was the thing you least wanted to lose.
 */

/** @param {{ term: string, why?: string, send?: boolean }[]} interests */
function scratch(interests) {
  const dir = mkdtempSync(join(tmpdir(), 'brief-rename-'))
  writeFileSync(join(dir, 'interests.json'), JSON.stringify({ interests }, null, 2))
  return dir
}

const find = (/** @type {string} */ dir, /** @type {string} */ term) =>
  readInterests(dir).find((i) => i.term === term)

test('a rename keeps the why and the send flag', () => {
  const dir = scratch([{ term: 'Unty', why: 'A typo I want to fix.', send: false }])

  renameInterest(dir, 'Unty', 'Unity')

  const after = find(dir, 'Unity')
  assert.ok(after, 'the renamed interest exists')
  assert.equal(after.why, 'A typo I want to fix.', 'the sentence survives')
  assert.equal(after.send, false, 'and so does the send flag, even when off')
  assert.equal(find(dir, 'Unty'), undefined, 'the old wording is gone')
})

test('the order is preserved, so the list does not reshuffle under you', () => {
  const dir = scratch([
    { term: 'first', send: true },
    { term: 'middle', send: true },
    { term: 'last', send: true }
  ])

  renameInterest(dir, 'middle', 'renamed')

  assert.deepEqual(
    readInterests(dir).map((i) => i.term),
    ['first', 'renamed', 'last']
  )
})

test('renaming onto an existing interest is refused, not merged', () => {
  // Merging would silently discard one of the two reasons, and the caller could
  // not tell it had happened.
  const dir = scratch([
    { term: 'Gold', why: 'keep me', send: true },
    { term: 'Oil', why: 'keep me too', send: true }
  ])

  assert.throws(() => renameInterest(dir, 'Oil', 'Gold'), /already an interest called "Gold"/)

  assert.equal(readInterests(dir).length, 2, 'nothing was lost')
  assert.equal(find(dir, 'Gold')?.why, 'keep me')
  assert.equal(find(dir, 'Oil')?.why, 'keep me too')
})

test('changing only the capitalisation is allowed', () => {
  // It is the same interest, so it must not collide with itself.
  const dir = scratch([{ term: 'roblox', why: 'x', send: true }])
  renameInterest(dir, 'roblox', 'Roblox')
  assert.equal(readInterests(dir)[0].term, 'Roblox')
})

test('an empty new term is refused', () => {
  const dir = scratch([{ term: 'Gold', why: 'x', send: true }])
  for (const bad of ['', '   ']) {
    assert.throws(() => renameInterest(dir, 'Gold', bad), /needs a term/)
  }
  assert.equal(find(dir, 'Gold')?.why, 'x')
})

test('renaming something that is not there is refused', () => {
  const dir = scratch([{ term: 'Gold', send: true }])
  assert.throws(() => renameInterest(dir, 'Silver', 'Platinum'), /No interest called "Silver"/)
  assert.equal(readInterests(dir).length, 1)
})

test('setInterest is not a rename, which is why rename is its own operation', () => {
  // The distinction the UI depends on: setInterest CREATES when it finds no
  // match, so using it for a rename would leave both wordings in the list.
  const dir = scratch([{ term: 'Old name', why: 'the reason', send: true }])

  setInterest(dir, { term: 'New name', why: 'the reason' })

  assert.equal(readInterests(dir).length, 2, 'setInterest added rather than renamed')
})

test('the file stays valid JSON with the same shape', () => {
  const dir = scratch([{ term: 'Gold', why: 'x', send: true }])
  renameInterest(dir, 'Gold', 'Precious metals')
  const raw = JSON.parse(readFileSync(join(dir, 'interests.json'), 'utf8'))
  assert.ok(Array.isArray(raw.interests), 'still an object with an interests array')
  assert.deepEqual(raw.interests[0], { term: 'Precious metals', why: 'x', send: true })
})
