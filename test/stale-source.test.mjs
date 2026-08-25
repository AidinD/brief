import { test } from 'node:test'
import assert from 'node:assert/strict'

import { dateInUrl, parseBrief, sourceAgeDays, titleNamesTheDate, STALE_SOURCE_DAYS } from '../src/domain/brief.js'

/*
 * On 2026-08-25 the brief led with "Spotify varslar 1 500 anställda, 17% av
 * styrkan" as news. Those are Spotify's December 2023 figures, and the link it
 * cited was five months old. Nothing in the app noticed.
 *
 * A brief that serves old news as this morning's is the failure that makes the
 * whole thing untrustworthy - worse than an empty brief, because an empty one is
 * honest. The app cannot stop the fetch reaching for something old, but it can
 * refuse to present it silently, using the publisher's own date rather than the
 * model's account of it.
 */

const NOW = Date.UTC(2026, 7, 25)
const daysAgo = (/** @type {number} */ n) => new Date(NOW - n * 86400000).toISOString().slice(0, 10).replace(/-/g, '/')

test('a date in a URL is read as the publisher wrote it', () => {
  assert.equal(dateInUrl('https://x.com/2026/03/23/story')?.toISOString().slice(0, 10), '2026-03-23')
  assert.equal(dateInUrl('https://x.com/2023/12/04/spotify')?.toISOString().slice(0, 10), '2023-12-04')
  assert.equal(dateInUrl('https://x.com/2026-08-24-thing')?.toISOString().slice(0, 10), '2026-08-24')
  // Month precision is common enough to read, defaulting to the first.
  assert.equal(dateInUrl('https://x.com/2026/08/monthly')?.toISOString().slice(0, 10), '2026-08-01')
})

test('a URL without a date is not guessed at', () => {
  // Most URLs carry no date. Inferring one would flag half the brief.
  for (const url of ['https://x.com/news/story', 'https://x.com/p/12345', '', 'not a url']) {
    assert.equal(dateInUrl(url), null, url)
  }
})

test('a version number is not mistaken for a date', () => {
  // "2024" in a path is not always a year, but a bare number with no month
  // beside it must not be read as one.
  assert.equal(dateInUrl('https://x.com/releases/2026'), null)
  assert.equal(dateInUrl('https://x.com/v/2026/13/bad-month'), null)
  assert.equal(dateInUrl('https://x.com/2026/00/zero-month'), null)
})

test('the newest source decides the age, not the oldest', () => {
  // A story may cite background alongside the news. The background being old is
  // not the story being old.
  const story = {
    anchor: `https://x.com/${daysAgo(1)}/todays-news`,
    sources: [
      { title: 'background', url: 'https://x.com/2019/04/01/history' },
      { title: 'today', url: `https://x.com/${daysAgo(1)}/todays-news` }
    ]
  }
  assert.equal(sourceAgeDays(story, NOW), 1)
})

test('a story with no dated source has no age, and that is not a fault', () => {
  assert.equal(sourceAgeDays({ anchor: 'https://x.com/news/x', sources: [] }, NOW), null)
})

test('parseBrief reports a stale source, and still keeps the story', () => {
  // Keeping it matters: dropping it would hide the fetch's mistake, and the
  // reader is the one who can tell whether the date is wrong or the story is.
  const raw = {
    date: '2026-08-25',
    world: {
      needsYou: [],
      worthKnowing: [
        {
          id: 'spotify',
          headline: 'Spotify varslar 1 500 anställda, 17% av styrkan',
          why: 'Ett av bolagen du följer.',
          anchor: 'https://www.digitalmusicnews.com/2026/03/23/spotify-triggers-layoffs/',
          sources: [{ title: 'x', url: 'https://www.digitalmusicnews.com/2026/03/23/spotify-triggers-layoffs/' }]
        }
      ]
    }
  }

  const { brief, problems, doubts } = parseBrief(raw, '2026-08-25', NOW)

  assert.equal(brief.world.worthKnowing.length, 1, 'the story is kept')
  assert.deepEqual(problems, [], 'a readable file raises no parse problem')
  const complaint = doubts.find((p) => /Spotify/.test(p))
  assert.ok(complaint, `expected a doubt naming the story, saw ${JSON.stringify(doubts)}`)
  assert.match(complaint, /155 days ago/)
  assert.match(complaint, /last 48 hours/)
})

test('a fresh story raises nothing', () => {
  const raw = {
    date: '2026-08-25',
    world: {
      needsYou: [],
      worthKnowing: [
        {
          id: 'fresh',
          headline: 'Something that happened yesterday',
          why: 'because',
          anchor: `https://x.com/${daysAgo(1)}/story`,
          sources: [{ title: 'x', url: `https://x.com/${daysAgo(1)}/story` }]
        }
      ]
    }
  }
  const { problems, doubts } = parseBrief(raw, '2026-08-25', NOW)
  assert.deepEqual(problems, [])
  assert.deepEqual(doubts, [])
})

test('the threshold leaves room for a source published last week', () => {
  // A filing read on Monday, a changelog from Friday. The check is for the
  // obviously old, not for precision.
  const within = {
    date: '2026-08-25',
    world: {
      needsYou: [],
      worthKnowing: [
        {
          id: 'lastweek',
          headline: 'Published a week ago',
          why: 'because',
          anchor: `https://x.com/${daysAgo(STALE_SOURCE_DAYS - 1)}/story`
        }
      ]
    }
  }
  assert.deepEqual(parseBrief(within, '2026-08-25', NOW).doubts, [])
})

test('a specification named by its revision date is not read as old news', () => {
  /*
   * The first false positive, on 2026-08-25. The MCP blog names its posts after
   * the spec revision - /posts/2026-07-28/, titled "The 2026-07-28
   * Specification" - and the post went up that morning. The window doubted it
   * for being 28 days old, which is exactly the kind of nagging that teaches you
   * to ignore the warning that matters.
   */
  const raw = {
    date: '2026-08-25',
    world: {
      needsYou: [
        {
          id: 'mcp-stateless-shift',
          headline: 'MCP-protokollet går mot statslös arkitektur',
          why: 'Du kör flera MCP-servrar lokalt.',
          anchor: 'MCP-servrar',
          sources: [
            { title: 'The New MCP Roadmap | Model Context Protocol Blog', url: 'https://blog.modelcontextprotocol.io/posts/mcp-roadmap/' },
            { title: 'The 2026-07-28 Specification | Model Context Protocol Blog', url: 'https://blog.modelcontextprotocol.io/posts/2026-07-28/' }
          ]
        }
      ],
      worthKnowing: []
    }
  }

  const { brief, doubts } = parseBrief(raw, '2026-08-25', NOW)
  assert.equal(brief.world.needsYou.length, 1, 'the story is untouched')
  assert.deepEqual(doubts, [], `a spec named by its date raised: ${JSON.stringify(doubts)}`)
})

test('a date written in prose in the title still dates the story', () => {
  // The rule keys on the ISO form, because that is what a designation looks
  // like. A recap that says "August 24, 2026" is dating itself, not naming
  // itself, so the URL's date stands.
  const story = {
    sources: [
      {
        title: 'Financial & Forex Market Recap – August 24, 2026',
        url: 'https://www.babypips.com/news/financial-forex-market-recap-2026-08-24'
      }
    ]
  }
  assert.equal(sourceAgeDays(story, NOW), 1)
})

test('a named revision does not hide a genuinely old source beside it', () => {
  // Suppressing the designation must not suppress the story: the other link is
  // still four years old, and that is still worth saying.
  const story = {
    sources: [
      { title: 'The 2026-07-28 Specification', url: 'https://x.com/posts/2026-07-28/' },
      { title: 'The original announcement', url: 'https://x.com/2022/05/09/announcement' }
    ]
  }
  const age = sourceAgeDays(story, NOW)
  assert.ok(age !== null && age > STALE_SOURCE_DAYS, `expected the old link to count, saw ${age}`)
})

test('titleNamesTheDate reads the separators publishers actually use', () => {
  const date = new Date(Date.UTC(2026, 6, 28))
  for (const title of ['The 2026-07-28 Specification', 'Spec 2026/07/28', 'v2026.07.28', 'build 20260728']) {
    assert.equal(titleNamesTheDate(title, date), true, title)
  }
  for (const title of ['The July specification', 'Published 28 July 2026', '', 'Spec 2026-07-27']) {
    assert.equal(titleNamesTheDate(title, date), false, title)
  }
})
