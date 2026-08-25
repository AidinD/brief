import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { fetchAssignment, judgeAssignment } from '../src/service/assignment.js'

/*
 * The fetch prompt is the one place where a careless edit turns a news reader
 * into something that tells somebody how to invest. These are the rules that
 * have to survive a rewrite of the surrounding prose.
 *
 * Asserted against the built prompt rather than the source, so a rule that moves
 * still counts and a rule that is deleted does not. Whitespace is flattened
 * first: the prompt is hard-wrapped, and a rule split across two lines is still
 * the rule.
 */

function scratch() {
  const dir = mkdtempSync(join(tmpdir(), 'brief-assignment-'))
  writeFileSync(
    join(dir, 'interests.json'),
    JSON.stringify({
      interests: [
        { term: 'Fear & Greed Index', why: 'Always report the reading.', send: true },
        { term: 'Market levels at extremes', why: 'Gold, oil, crypto.', send: true }
      ]
    })
  )
  writeFileSync(join(dir, 'outbound.json'), JSON.stringify({ entries: [] }))
  return dir
}

/** The prompt as one line, so a hard-wrapped sentence still matches. */
const flat = () => fetchAssignment({ dataDir: scratch(), jotDir: scratch() }).replace(/\s+/g, ' ')

test('the fetch is forbidden from carrying a recommendation', () => {
  // The whole difference between a market scan and investment advice.
  const text = flat().toLowerCase()
  for (const banned of ['forecast', 'price target', 'analyst rating', 'buy or sell']) {
    assert.ok(text.includes(banned), `the prompt must name "${banned}" as excluded`)
  }
  assert.match(
    flat(),
    /never include a forecast/i,
    'stated as a prohibition, not a preference'
  )
})

test('a market figure may never be filed as needing the reader', () => {
  // A number in the needs-you column is the app telling somebody to trade.
  assert.match(flat(), /always "worth knowing", never "needs you"/i)
})

test('a standing gauge is exempt from the 48-hour rule', () => {
  // Without this a reading is dropped on every ordinary day: the rule above it
  // is written for events, and a gauge is a state.
  assert.match(flat(), /every day, whatever it reads/i)
  assert.match(flat(), /exception to the 48-hour rule/i)
})

test('a level has to arrive as a number with its comparison', () => {
  assert.match(flat(), /report the NUMBER/i)
  assert.match(flat(), /compared against/i)
  // The worked example is what makes the rule unambiguous.
  assert.match(flat(), /highest close since/i)
})

test('a geopolitical event may not be paired with a price conclusion', () => {
  // "Tensions rose, so look at oil" is exactly the inference that has to stay
  // with the reader rather than arriving pre-drawn.
  assert.match(flat(), /never pair it with a conclusion about what it does to a price/i)
})

test('the standing rules the prompt already had are still there', () => {
  // Not new, but the edit that adds market rules is the one likely to drop
  // these, and both cost more trust than a missed story.
  assert.match(flat(), /do not infer what they do for a living/i)
  assert.match(flat(), /the board is not the filter/i)
})

test('the judge step is self-contained', () => {
  const text = judgeAssignment({ dataDir: scratch() })
  assert.match(text, /needsYou/i)
  assert.ok(text.length > 200, 'the judge assignment should not be a stub')
})
