import { test } from 'node:test'
import assert from 'node:assert/strict'

import { LIMITS, clamp, emptyBrief, isStale, parseBrief, parseLesson } from '../src/domain/brief.js'
import { localDate, relativeDay } from '../src/domain/time.js'

const NOW = Date.UTC(2026, 7, 23, 9, 0, 0)

/** @param {number} n @param {string} prefix */
const items = (n, prefix) =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, headline: `${prefix} ${i}`, why: '' }))

test('a brief that is over its limit is cut, and says so', () => {
  const brief = emptyBrief('2026-08-23', NOW)
  brief.world.needsYou = items(LIMITS.needsYou + 3, 'n')
  brief.world.worthKnowing = items(LIMITS.worthKnowing + 1, 'w')

  const { brief: cut, dropped } = clamp(brief)

  assert.equal(cut.world.needsYou.length, LIMITS.needsYou)
  assert.equal(cut.world.worthKnowing.length, LIMITS.worthKnowing)
  assert.deepEqual(dropped, [
    { section: 'needs you', count: 3 },
    { section: 'worth knowing', count: 1 }
  ])
})

test('the overflow is reported rather than silently trimmed', () => {
  // The whole reason clamp returns `dropped` at all. A brief that quietly
  // truncates looks like a short day, and the generator never gets corrected.
  const brief = emptyBrief('2026-08-23', NOW)
  brief.confirm = Array.from({ length: LIMITS.confirm + 4 }, (_, i) => ({
    id: `c${i}`,
    kind: /** @type {const} */ ('decision'),
    text: `candidate ${i}`
  }))

  const { dropped } = clamp(brief)
  assert.deepEqual(dropped, [{ section: 'confirm', count: 4 }])
})

test('a brief exactly at the limit is not reported as overflowing', () => {
  const brief = emptyBrief('2026-08-23', NOW)
  brief.world.needsYou = items(LIMITS.needsYou, 'n')
  assert.deepEqual(clamp(brief).dropped, [])
})

test('parseBrief keeps what it can and drops only what is unusable', () => {
  const { brief, problems } = parseBrief(
    {
      date: '2026-08-23',
      world: {
        needsYou: [
          { headline: 'Something happened', why: 'It touches Northwind', anchor: 'Northwind' },
          { why: 'no headline, so no item' }
        ]
      },
      confirm: [{ kind: 'story', text: 'A thing worth remembering' }]
    },
    '2026-01-01',
    NOW
  )

  assert.equal(brief.world.needsYou.length, 1)
  assert.equal(brief.world.needsYou[0].anchor, 'Northwind')
  assert.equal(brief.confirm.length, 1)
  assert.equal(brief.confirm[0].kind, 'story')
  assert.equal(problems.length, 1, 'the dropped item is reported')
})

test('an item with no headline is dropped rather than rendered blank', () => {
  const { brief } = parseBrief({ world: { worthKnowing: [{ why: 'only a why' }] } }, '2026-08-23', NOW)
  assert.deepEqual(brief.world.worthKnowing, [])
})

test('an unknown candidate kind is read as a decision, and reported', () => {
  const { brief, problems } = parseBrief(
    { confirm: [{ text: 'Something', kind: 'invention' }] },
    '2026-08-23',
    NOW
  )
  assert.equal(brief.confirm[0].kind, 'decision')
  assert.match(problems.join(' '), /invention/)
})

test('a source with no url is dropped, because a link that goes nowhere is worse than none', () => {
  const { brief } = parseBrief(
    { world: { needsYou: [{ headline: 'x', sources: [{ title: 'no url' }, { url: 'https://example.com' }] }] } },
    '2026-08-23',
    NOW
  )
  assert.deepEqual(brief.world.needsYou[0].sources, [{ title: '', url: 'https://example.com' }])
})

test('a file that is not an object still yields a usable empty brief', () => {
  const { brief, problems } = parseBrief('nonsense', '2026-08-23', NOW)
  assert.equal(brief.date, '2026-08-23')
  assert.deepEqual(brief.world.needsYou, [])
  assert.equal(problems.length, 1)
})

test('a brief from another day is stale', () => {
  assert.equal(isStale(emptyBrief('2026-08-22', NOW), '2026-08-23'), true)
  assert.equal(isStale(emptyBrief('2026-08-23', NOW), '2026-08-23'), false)
})

test('the date is the local one, not UTC', () => {
  // 01:00 local on the 24th is still the 23rd in UTC. Using toISOString would
  // have made the morning brief look stale at breakfast for anyone east of
  // Greenwich, which is everyone this is built for.
  const oneAm = new Date(2026, 7, 24, 1, 0, 0).getTime()
  assert.equal(localDate(oneAm), '2026-08-24')
})

test('relativeDay names today and yesterday and otherwise gets out of the way', () => {
  const noon = new Date(2026, 7, 23, 12, 0, 0).getTime()
  assert.equal(relativeDay('2026-08-23', noon), 'today')
  assert.equal(relativeDay('2026-08-22', noon), 'yesterday')
  assert.equal(relativeDay('2026-08-01', noon), '2026-08-01')
})

test('what you are behind on is capped tighter than anything else, and the drop is shown', () => {
  /*
   * The section exists because Tend's overdue list had been arriving in the
   * confirm section, where the two answers on offer - keep it, not this - are
   * both false of something you are behind on. Keeping files a status that is
   * stale within the month; rejecting says it does not matter, when it does.
   *
   * The cap is the tightest in the app on purpose. Everything overdue at once is
   * a backlog, and a backlog on a morning page is what this app exists not to be.
   */
  const brief = emptyBrief('2026-08-25', 0)
  brief.behind = items(LIMITS.behind + 4, 'b')

  const { brief: cut, dropped } = clamp(brief)

  assert.equal(cut.behind.length, LIMITS.behind)
  assert.deepEqual(dropped, [{ section: 'behind', count: 4 }])
  assert.ok(LIMITS.behind < LIMITS.confirm, 'behind is the tightest cap')
})

test('a brief written before the behind section existed still reads', () => {
  // Every brief already on disk lacks the field, and a morning that renders
  // nothing because yesterday's file is a version behind is worse than the bug
  // this section fixed.
  const { brief } = parseBrief({ date: '2026-08-25', world: { needsYou: [], worthKnowing: [] } }, '2026-08-25', 0)
  assert.deepEqual(brief.behind, [])
  assert.deepEqual(clamp(brief).dropped, [])
})

test('behind carries the same shape as a world item, and drops a blank one the same way', () => {
  const { brief, problems } = parseBrief(
    {
      date: '2026-08-25',
      behind: [
        { id: 'b1', headline: 'Feedbackrundan är 62 veckor försenad', why: 'Målet är var 90:e dag.', anchor: 'Tend: feedback rounds' },
        { id: 'b2', why: 'no headline' }
      ]
    },
    '2026-08-25',
    0
  )

  assert.equal(brief.behind.length, 1)
  assert.equal(brief.behind[0].anchor, 'Tend: feedback rounds')
  assert.ok(
    problems.some((p) => /behind/.test(p)),
    `the drop should name the section, saw ${JSON.stringify(problems)}`
  )
})

test('a lesson needs both halves, because neither works alone', () => {
  /*
   * A title with no sentence under it is a heading; a sentence with no title is
   * a fortune cookie. Rendering either teaches you to skip the bottom of the
   * page, which is where the one thing that asks nothing of you lives.
   */
  assert.equal(parseLesson({ title: '1.1 · Kritisera inte', line: '' }), null)
  assert.equal(parseLesson({ title: '   ', line: 'En mening.' }), null)
  assert.equal(parseLesson(null), null)
  assert.equal(parseLesson('a string'), null)
})

test('a lesson keeps the wording it was written in', () => {
  // The point of a library you wrote yourself is recognising the sentence the
  // second time. A parser that trimmed or reflowed it would defeat that.
  const lesson = parseLesson({
    id: 'note-sample',
    title: '1.1 · Kritisera inte - fråga i stället',
    line: 'Kritik får nästan alltid mottagaren att försvara sitt beslut i stället för att ompröva det.',
    source: 'How to Win Friends and Influence People',
    why: 'Fyra feedbackrundor väntar'
  })

  assert.ok(lesson)
  assert.equal(lesson.title, '1.1 · Kritisera inte - fråga i stället')
  assert.match(lesson.line, /ompröva det\.$/)
  assert.equal(lesson.source, 'How to Win Friends and Influence People')
  assert.equal(lesson.why, 'Fyra feedbackrundor väntar')
})

test('a lesson falls back to its own title for an id, so rotation still works', () => {
  const lesson = parseLesson({ title: 'Namnlös princip', line: 'En mening.' })
  assert.equal(lesson?.id, 'Namnlös princip')
})

test('a brief with no lesson is a brief, not a broken one', () => {
  // Some mornings the library is unreachable or everything in it is too recent.
  // Nothing is the honest answer, and it must not read as a parse failure.
  const { brief, problems } = parseBrief({ date: '2026-08-25' }, '2026-08-25', 0)
  assert.equal(brief.lesson, null)
  assert.deepEqual(problems, [])
  assert.equal(emptyBrief('2026-08-25', 0).lesson, null)
})

test('the lesson is one, and clamp has nothing to say about it', () => {
  // The cap is the shape: a single object, never a list. Two principles a
  // morning is a reading list, and a reading list does not get read.
  const brief = emptyBrief('2026-08-25', 0)
  brief.lesson = { id: 'x', title: 'En princip', line: 'En mening.' }
  const { brief: cut, dropped } = clamp(brief)
  assert.equal(cut.lesson?.title, 'En princip')
  assert.deepEqual(dropped, [])
})
