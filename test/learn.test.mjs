import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { parseBrief } from '../src/domain/brief.js'
import { isTopicId, parseArticle, parseTopic, readingMinutes } from '../src/domain/learn.js'
import { renderArticle } from '../src/service/article.js'
import { learnPage, today } from '../src/service/api.js'
import { openStore } from '../src/storage/store.js'

/*
 * The card, the page behind it, and the one thing that connects them: an id
 * that becomes a filename. Most of what is below is about that id, because it
 * is the only place in this app where a value written by a model is turned into
 * a path.
 */

const scratch = () => mkdtempSync(join(tmpdir(), 'brief-learn-'))

/** @param {string} dir @param {string} id @param {any} article */
function writeArticle(dir, id, article) {
  mkdirSync(join(dir, 'learn'), { recursive: true })
  writeFileSync(join(dir, 'learn', `${id}.json`), JSON.stringify(article), 'utf8')
}

/** A small but complete article, so a test can change one thing about it. */
const anArticle = (/** @type {any} */ extra = {}) => ({
  id: 'git-worktrees',
  title: 'Git worktrees',
  standfirst: 'Vad en worktree faktiskt är.',
  sections: [
    {
      heading: 'Vad det är',
      blocks: [
        { kind: 'text', text: 'En till arbetskatalog kopplad till samma .git.' },
        { kind: 'code', language: 'bash', code: 'git worktree add ../hotfix main' }
      ]
    }
  ],
  takeaways: ['Databasen delas, arbetskatalogen gör det inte.'],
  sources: [{ title: 'git-worktree', url: 'https://git-scm.com/docs/git-worktree' }],
  ...extra
})

/* ------------------------------------------------------------- the id -- */

test('an id that could name anything but a file is refused', () => {
  // The id arrives in brief.json, written by a model, and is joined onto a path.
  // Everything below is a way to leave the learn directory or to be a different
  // file than it looks like.
  for (const id of ['../secrets', 'a/b', 'a\\b', '..', '.', 'a.json', 'Git-Worktrees', '', 'a b', 'x'.repeat(65)]) {
    assert.equal(isTopicId(id), false, `"${id}" should not be usable as a filename`)
  }
  for (const id of ['git-worktrees', 'useeffect', 'http2', 'a']) {
    assert.equal(isTopicId(id), true, `"${id}" is an ordinary slug`)
  }
})

test('a card with an unusable id is no card, because its button could not work', () => {
  // Dropping the whole card rather than rendering it without a button: an id
  // that is not a slug means the generator wrote something this app cannot
  // follow, and a title standing alone at the bottom of the page is a mystery
  // rather than a topic.
  assert.equal(parseTopic({ id: '../etc/passwd', title: 'Git', line: 'En mening.' }), null)
  assert.equal(parseTopic({ title: 'Git', line: 'En mening.' }), null)
})

test('half a card is no card, exactly as with the principle', () => {
  assert.equal(parseTopic({ id: 'git', title: 'Git', line: '   ' }), null)
  assert.equal(parseTopic({ id: 'git', title: '', line: 'En mening.' }), null)
  assert.equal(parseTopic(null), null)
  assert.equal(parseTopic('a string'), null)
})

test('a card keeps its own wording, å ä ö intact', () => {
  const topic = parseTopic({
    id: 'git-worktrees',
    title: 'Git worktrees',
    line: 'En worktree är ännu en arbetskatalog kopplad till samma .git-mapp.',
    why: 'Två agenter i samma repo'
  })
  assert.ok(topic)
  assert.equal(topic.id, 'git-worktrees')
  assert.match(topic.line, /ännu en arbetskatalog/)
  assert.equal(topic.why, 'Två agenter i samma repo')
})

test('a brief with no topic is a brief, not a broken one', () => {
  const { brief, problems } = parseBrief({ date: '2026-09-03' }, '2026-09-03', 0)
  assert.equal(brief.learn, null)
  assert.deepEqual(problems, [])
})

/* ---------------------------------------------------------- the article -- */

test('an article with nothing readable in it is null, so the button stays away', () => {
  assert.equal(parseArticle({ title: 'Git', sections: [] }), null)
  assert.equal(parseArticle({ title: 'Git', sections: [{ heading: 'Vad det är', blocks: [] }] }), null)
  assert.equal(parseArticle({ title: '', sections: [{ blocks: [{ kind: 'text', text: 'x' }] }] }), null)
  assert.equal(parseArticle(null), null)
})

test('a block that forgot to say what it is still reads as a paragraph', () => {
  // Forgiving in the same direction as parseBrief: a missing "kind" should cost
  // the formatting, never the sentence.
  const article = parseArticle({ title: 'Git', sections: [{ heading: '', blocks: [{ text: 'En mening.' }] }] })
  assert.deepEqual(article?.sections[0].blocks, [{ kind: 'text', text: 'En mening.' }])
})

test('a source with no usable url is dropped, like a story with a dead link', () => {
  const article = parseArticle(
    anArticle({ sources: [{ title: 'nowhere', url: '' }, { title: 'file', url: 'file:///C:/passwords.txt' }] })
  )
  assert.deepEqual(article?.sources, [])
})

test('the reading time is measured off the page, never taken on trust', () => {
  const short = parseArticle(anArticle())
  assert.ok(short)
  assert.equal(readingMinutes(short), 1, 'a few sentences is a minute, not three')

  const long = parseArticle(
    anArticle({
      sections: [
        {
          heading: 'Långt',
          blocks: [{ kind: 'text', text: 'ord '.repeat(1200) }]
        }
      ],
      minutes: 3
    })
  )
  assert.ok(long)
  assert.ok(readingMinutes(long) >= 6, `expected the real length to show, got ${readingMinutes(long)}`)
})

/* --------------------------------------------------------- the rendering -- */

test('the page carries no markup the generator wrote', () => {
  // The whole reason this app renders the page instead of asking for HTML. A
  // file written by a model and opened in a browser is a file a browser will
  // run, and "it would not write a script tag" is a hope rather than a boundary.
  const article = parseArticle(
    anArticle({
      title: '<script>alert(1)</script>',
      sections: [
        {
          heading: 'Vad det är',
          blocks: [{ kind: 'text', text: '<img src=x onerror="alert(2)">' }]
        }
      ],
      sources: [{ title: '"><script>alert(3)</script>', url: 'https://example.com/' }]
    })
  )
  assert.ok(article)
  const html = renderArticle(article)

  // Escaped, so `onerror=` does appear - as five visible characters inside a
  // paragraph. What must not appear is a tag: the check is on the angle bracket,
  // which is the only thing that decides whether a browser reads it as markup.
  assert.ok(!/<(script|img|iframe|object|svg|style)/i.test(html.replace(/<style>[\s\S]*?<\/style>/, '')),
    'a tag written by the generator survived into the page')
  assert.match(html, /&lt;script&gt;/, 'the text is still there, as text')
  assert.match(html, /onerror=&quot;alert\(2\)&quot;/, 'and reads as the text it was')
})

test('the page needs nothing from the network to look right', () => {
  const article = parseArticle(anArticle())
  assert.ok(article)
  const html = renderArticle(article, { date: '2026-09-03' })

  // Read off a disk on a morning that has not gone online yet. The only http in
  // the file should be the sources, which are links rather than loads.
  assert.ok(!/<link\b/i.test(html), 'the page pulls in a stylesheet')
  assert.ok(!/<script\b/i.test(html), 'the page runs something')
  assert.ok(!/src=/i.test(html), 'the page loads a resource')
  assert.equal((html.match(/https?:\/\//g) ?? []).length, 1, 'only the one source link')

  assert.match(html, /Git worktrees/)
  assert.match(html, /git worktree add \.\.\/hotfix main/)
  assert.match(html, /2026-09-03/)
})

/* ------------------------------------------------------ the way in to it -- */

test('the window is told whether there is a page, so it can leave the button off', () => {
  const dir = scratch()
  const store = openStore({ dataDir: dir })
  const now = Date.now()
  const date = new Date(now)
  const local = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

  store.write({
    version: 1,
    date: local,
    generatedAt: now,
    world: { needsYou: [], worthKnowing: [] },
    behind: [],
    week: { summary: '', moments: [] },
    confirm: [],
    lesson: null,
    learn: { id: 'git-worktrees', title: 'Git worktrees', line: 'En mening.' },
    notes: []
  })

  const withoutArticle = today(store, now)
  assert.equal(withoutArticle.article.ready, false, 'a card with no page must not offer a button')
  assert.equal(withoutArticle.article.minutes, null)
  assert.ok(learnPage(store, now).error, 'and opening it says so rather than failing silently')

  writeArticle(dir, 'git-worktrees', anArticle())

  const withArticle = today(store, now)
  assert.equal(withArticle.article.ready, true)
  assert.equal(withArticle.article.minutes, 1)

  const page = learnPage(store, now)
  assert.equal(page.error, undefined)
  assert.match(String(page.path), /git-worktrees\.html$/)
})

test('an article that is not where the card says it is costs the button, not the brief', () => {
  const dir = scratch()
  const store = openStore({ dataDir: dir })
  const now = Date.now()
  const date = new Date(now)
  const local = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

  writeFileSync(
    join(dir, 'brief.json'),
    JSON.stringify({
      version: 1,
      date: local,
      learn: { id: 'git-worktrees', title: 'Git worktrees', line: 'En mening.' }
    }),
    'utf8'
  )
  mkdirSync(join(dir, 'learn'), { recursive: true })
  writeFileSync(join(dir, 'learn', 'git-worktrees.json'), '{ this is not json', 'utf8')

  const state = today(store, now)
  assert.equal(state.article.ready, false)
  assert.equal(state.brief.learn?.title, 'Git worktrees', 'the card itself still renders')
  assert.deepEqual(state.problems, [], 'an unreadable article is not a problem with the brief')
})

test('the store will not build a path out of anything but a slug', () => {
  const store = openStore({ dataDir: scratch() })
  assert.equal(store.article('../brief'), null)
  assert.throws(() => store.writeArticlePage('../escape', '<p>x</p>'), /not a usable topic id/)
})
