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
  const text = judgeAssignment({ dataDir: scratch(), nibDir: scratch() })
  assert.match(text, /needsYou/i)
  assert.ok(text.length > 200, 'the judge assignment should not be a stub')
})

const flatJudge = () => judgeAssignment({ dataDir: scratch(), nibDir: scratch() }).replace(/\s+/g, ' ')

test('the judge is told an overdue commitment goes in behind, never in confirm', () => {
  /*
   * The first brief that reached Tend put three overdue duties in the confirm
   * section, where the only two answers are keep and reject and neither one is
   * true. A prompt that does not say where they go gets that answer again.
   */
  const prompt = flatJudge()

  assert.match(prompt, /belongs HERE and never in confirm/i)
  assert.match(prompt, /keeping it files a status that is stale/i)
  assert.match(prompt, /behind 3/, 'the cap is stated with the others')
  assert.match(prompt, /"behind":/, 'the shape includes the section')
})

test('the judge is told a candidate must be answerable, and that Tend already holds its own', () => {
  const prompt = flatJudge()

  // The old rule named DECISIONS.md only, so a duty in Tend read as fair game.
  assert.match(prompt, /Anything a system already holds and keeps holding is not a candidate/i)
  assert.match(prompt, /a duty in Tend and a task in Jot/i)
  assert.match(prompt, /must be ANSWERABLE by keep or reject/i)
})

test('a moment is dated from its timestamp, never from a "days ago" phrase', () => {
  /*
   * Every moment in the first brief that read the Tend journal was labelled one
   * day late: Friday came out as Saturday, Wednesday as Thursday. The cause is
   * that Tend's "3 days ago" is floored, so counting weekdays back from it
   * arrives a day after the entry was actually written. The week is the one
   * section the reader can check against their own memory, so it is the one
   * that must not be off by one.
   */
  const prompt = flatJudge()
  assert.match(prompt, /comes from the entry's OWN timestamp/i)
  assert.match(prompt, /Never from a phrase like "3 days ago"/i)
  assert.match(prompt, /check the weekday against the date/i)
})

test('the judge is told a backlog is not a brief', () => {
  const prompt = flatJudge()
  assert.match(prompt, /At most three/i)
  assert.match(prompt, /a backlog on a morning page is the thing this app exists not to be/i)
})

test('the judge is told to take the principle as written, not to improve it', () => {
  /*
   * The library is 13 principles written by hand over months, from How to Win
   * Friends and The Manager's Path. The value is recognising the sentence the
   * second time, which a paraphrase destroys while looking like an improvement.
   */
  const prompt = flatJudge()

  assert.match(prompt, /Do not paraphrase and do not improve them/i)
  assert.match(prompt, /Exactly ONE, or none at all/i)
  assert.match(prompt, /a reading list does not get read/i)
})

test('the judge is told where the library is and not to repeat itself', () => {
  const prompt = flatJudge()

  assert.match(prompt, /index\.json/, 'the Nib index is named')
  assert.match(prompt, /tag whose name is "Principle"/i)
  assert.match(prompt, /lessons\.jsonl/, 'rotation has a file to read and append to')
  assert.match(prompt, /last thirty entries/i)
  assert.match(prompt, /in WHICHEVER category they sit/i, 'not only the ones from books')
})

test('the rotation degrades to the oldest rather than going silent', () => {
  // The library is 25 principles and a thirty-day exclusion would empty it on
  // day 26, turning a working feature off for good with nothing to show why.
  const prompt = flatJudge()

  assert.match(prompt, /take the least recently seen one instead/i)
  assert.match(prompt, /Going silent because everything has been shown once is the wrong failure/i)
})

test('the principle may never be turned into a rebuke, or invented', () => {
  // It is the one thing on the page that asks for nothing. A "why" that says
  // what the reader did wrong makes it one more demand.
  const prompt = flatJudge()

  assert.match(prompt, /Never a rebuke/i)
  assert.match(prompt, /never what the reader did wrong/i)
  assert.match(prompt, /an invented one is worse than none/i)
  assert.match(prompt, /A morning without one is fine/i)
})

test('the topic is craft, never news, and never about code it cannot read', () => {
  /*
   * Two failure modes, and both look fine on the page.
   *
   * A topic drawn from what happened this week is the world section again, in
   * the one place that was supposed to be immune to it - the value of this card
   * is precisely that it is still true in five years.
   *
   * And a confident paragraph about keel or Jot, written by a session that
   * cannot read their source, is the same class of mistake as a "needs you"
   * that needs somebody else: it costs more trust than a missing topic does.
   */
  const prompt = flatJudge()

  assert.match(prompt, /it is never news/i)
  assert.match(prompt, /still be true in five years/i)
  assert.match(prompt, /Never write about the reader's own repositories/i)
  assert.match(prompt, /Never invent an API, a flag or a function name/i)
})

test('the topic asks for nothing, like the principle beside it', () => {
  // A card at the bottom of the page that ends in "try this in your project" is
  // one more task, on the one part of the page that is not supposed to have any.
  const prompt = flatJudge()

  assert.match(prompt, /No exercise, no homework/i)
  assert.match(prompt, /It is a read/i)
})

test('the topic card is readable on its own, rather than being a teaser', () => {
  // The line between this and a feed. A sentence that withholds the point to
  // make you click is what an engagement surface writes.
  const prompt = flatJudge()

  assert.match(prompt, /"line" is not a teaser/i)
  assert.match(prompt, /knowing one true thing/i)
})

test('the deep dive is written as values, and the article lands before the brief', () => {
  const prompt = flatJudge()

  assert.match(prompt, /learn.<id>\.json/i, 'the article has a named file')
  assert.match(prompt, /lowercase letters, digits and hyphens only/i, 'because it is a filename')
  assert.match(prompt, /Values, never markup/i)
  assert.match(prompt, /the article FIRST and brief\.json last/i)
  assert.match(prompt, /learned\.jsonl/, 'rotation has a file to read and append to')
  assert.match(prompt, /never repeat a topic that appears in it/i)
})
