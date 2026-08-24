import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { fromJot, holdings } from '../src/service/holdings.js'
import { draftOutbound, readOutbound, sendable, setEntry } from '../src/service/outbound.js'
import * as api from '../src/service/api.js'

/**
 * @template T
 * @param {(dir: string) => T} body
 * @returns {T}
 */
function scratch(body) {
  const dir = mkdtempSync(join(tmpdir(), 'brief-out-'))
  try {
    return body(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** A small Jot board, shaped like the real one. */
const BOARD = {
  categories: [
    { id: 'c1', name: 'Northwind', domain: 'work' },
    { id: 'c2', name: 'Household', domain: 'private' }
  ],
  todos: [
    { id: 't1', text: 'Ship the payout change', status: 'in-progress', categoryId: 'c1' },
    { id: 't2', text: 'Something finished', status: 'done', categoryId: 'c1' },
    { id: 't3', text: 'Finish the loft shelves', status: 'in-progress', categoryId: 'c2' }
  ]
}

test('holdings come from the board: areas, then what is actually moving', () => {
  scratch((dir) => {
    writeFileSync(join(dir, 'todos.json'), JSON.stringify(BOARD), 'utf8')
    const held = fromJot(dir)
    assert.deepEqual(held, [
      { kind: 'area', label: 'Northwind' },
      { kind: 'area', label: 'Household' },
      { kind: 'in progress', label: 'Ship the payout change', detail: 'Northwind' },
      { kind: 'in progress', label: 'Finish the loft shelves', detail: 'Household' }
    ])
  })
})

test('a board that is not there is not an error', () => {
  scratch((dir) => {
    assert.deepEqual(fromJot(dir), [])
    assert.deepEqual(holdings({ dataDir: dir, jotDir: dir }), [])
  })
})

test('nothing is sendable until somebody says so', () => {
  scratch((dir) => {
    writeFileSync(join(dir, 'todos.json'), JSON.stringify(BOARD), 'utf8')
    // The board is readable and full of things. None of it may be sent.
    assert.ok(holdings({ dataDir: dir, jotDir: dir }).length > 0)
    assert.deepEqual(sendable(dir), [])
  })
})

test('the drafted list arrives switched off', () => {
  scratch((dir) => {
    writeFileSync(join(dir, 'todos.json'), JSON.stringify(BOARD), 'utf8')
    const held = holdings({ dataDir: dir, jotDir: dir })
    const { total, added } = draftOutbound(dir, held)

    assert.equal(total, held.length)
    assert.equal(added, held.length)
    // Off is the point. A generated file that arrives ticked is a file nobody
    // reads, and this one exists to be read.
    assert.deepEqual(readOutbound(dir).filter((e) => e.send), [])
    assert.deepEqual(sendable(dir), [])
  })
})

test('re-drafting after the board changes keeps every decision already made', () => {
  scratch((dir) => {
    writeFileSync(join(dir, 'todos.json'), JSON.stringify(BOARD), 'utf8')
    draftOutbound(dir, holdings({ dataDir: dir, jotDir: dir }))

    const list = JSON.parse(readFileSync(join(dir, 'outbound.json'), 'utf8'))
    list.allow.find((/** @type {any} */ e) => e.label === 'Northwind').send = true
    writeFileSync(join(dir, 'outbound.json'), JSON.stringify(list), 'utf8')

    const bigger = { ...BOARD, categories: [...BOARD.categories, { id: 'c3', name: 'New thing' }] }
    writeFileSync(join(dir, 'todos.json'), JSON.stringify(bigger), 'utf8')
    const { added } = draftOutbound(dir, holdings({ dataDir: dir, jotDir: dir }))

    assert.equal(added, 1)
    assert.deepEqual(sendable(dir), [{ label: 'Northwind', kind: 'area' }])
  })
})

test('a ticked item that leaves the board keeps its tick', () => {
  scratch((dir) => {
    writeFileSync(
      join(dir, 'outbound.json'),
      JSON.stringify({ allow: [{ label: 'Long-running thing', kind: 'area', send: true }] }),
      'utf8'
    )
    // Deleting a task in Jot is not a decision about what may be searched for.
    draftOutbound(dir, [])
    assert.deepEqual(sendable(dir), [{ label: 'Long-running thing', kind: 'area' }])
  })
})

test('"as" is what leaves, so a codename can stay behind', () => {
  scratch((dir) => {
    writeFileSync(
      join(dir, 'outbound.json'),
      JSON.stringify({
        allow: [{ label: 'Kestrel', kind: 'area', send: true, as: 'AI-assisted content pipelines' }]
      }),
      'utf8'
    )
    const out = sendable(dir)
    assert.deepEqual(out, [{ label: 'AI-assisted content pipelines', kind: 'area' }])
    assert.equal(
      JSON.stringify(out).includes('Kestrel'),
      false,
      'the codename must not survive into anything that gets sent'
    )
  })
})

test('a corrupt outbound list sends nothing rather than falling back to everything', () => {
  scratch((dir) => {
    writeFileSync(join(dir, 'outbound.json'), '{ broken', 'utf8')
    assert.deepEqual(sendable(dir), [])
  })
})

/* ------------------------------------------- ticking it from the window -- */

test('setEntry turns one row on, and only that row', () => {
  scratch((dir) => {
    writeFileSync(join(dir, 'todos.json'), JSON.stringify(BOARD), 'utf8')
    draftOutbound(dir, holdings({ dataDir: dir, jotDir: dir }))

    setEntry(dir, { label: 'Northwind', kind: 'area', send: true })

    assert.deepEqual(sendable(dir), [{ label: 'Northwind', kind: 'area' }])
    assert.equal(readOutbound(dir).filter((e) => e.send).length, 1)
  })
})

test('setEntry can turn a row back off', () => {
  scratch((dir) => {
    setEntry(dir, { label: 'Northwind', kind: 'area', send: true })
    setEntry(dir, { label: 'Northwind', kind: 'area', send: false })
    assert.deepEqual(sendable(dir), [])
  })
})

test('setting an alias does not switch the row on by itself', () => {
  scratch((dir) => {
    // Typing a safer description is not the same as deciding to send it, and
    // a control that says otherwise sends something the user only drafted.
    setEntry(dir, { label: 'Kestrel', kind: 'area', as: 'AI-assisted content pipelines' })
    assert.deepEqual(sendable(dir), [])

    setEntry(dir, { label: 'Kestrel', kind: 'area', send: true })
    assert.deepEqual(sendable(dir), [{ label: 'AI-assisted content pipelines', kind: 'area' }])
  })
})

test('changing the alias keeps the row on, and changes what leaves', () => {
  scratch((dir) => {
    setEntry(dir, { label: 'Kestrel', kind: 'area', send: true, as: 'first wording' })
    setEntry(dir, { label: 'Kestrel', kind: 'area', as: 'second wording' })
    assert.deepEqual(sendable(dir), [{ label: 'second wording', kind: 'area' }])
  })
})

test('clearing the alias falls back to the label, which is a real decision', () => {
  scratch((dir) => {
    // Emptying the box means "send the actual name". It has to be possible -
    // and it has to be visible, which is why the window quotes what would go.
    setEntry(dir, { label: 'Northwind', kind: 'area', send: true, as: 'something else' })
    setEntry(dir, { label: 'Northwind', kind: 'area', as: '' })
    assert.deepEqual(sendable(dir), [{ label: 'Northwind', kind: 'area' }])
  })
})

test('setEntry refuses an entry with no label instead of writing a blank row', () => {
  scratch((dir) => {
    assert.throws(() => setEntry(dir, { label: '   ' }), /needs a label/)
    assert.deepEqual(readOutbound(dir), [])
  })
})

test('the module offers no way to allow everything at once', () => {
  // Load-bearing. A switch that flips fifty rows is a switch that gets flipped
  // without reading them, which leaves the leak plus the comfort of a list.
  const source = readFileSync(new URL('../src/service/outbound.js', import.meta.url), 'utf8')
  assert.equal(/allowAll|enableAll|sendEverything/i.test(source), false)
})

test('the outbound view reports what would be sent, not just what is ticked', () => {
  scratch((dir) => {
    writeFileSync(join(dir, 'todos.json'), JSON.stringify(BOARD), 'utf8')
    draftOutbound(dir, holdings({ dataDir: dir, jotDir: dir }))
    setEntry(dir, { label: 'Northwind', kind: 'area', send: true, as: 'social gaming platforms' })

    const state = api.outbound({ dataDir: dir, jotDir: dir })

    assert.deepEqual(state.sending, [{ label: 'social gaming platforms', kind: 'area' }])
    assert.equal(
      JSON.stringify(state.sending).includes('Northwind'),
      false,
      'the window must quote what leaves, not the label it came from'
    )
    assert.equal(state.unreviewed, 0)
  })
})

test('a board that grew shows up as unreviewed rather than silently ticked', () => {
  scratch((dir) => {
    writeFileSync(join(dir, 'todos.json'), JSON.stringify(BOARD), 'utf8')
    draftOutbound(dir, holdings({ dataDir: dir, jotDir: dir }))

    const bigger = { ...BOARD, categories: [...BOARD.categories, { id: 'c9', name: 'Brand new area' }] }
    writeFileSync(join(dir, 'todos.json'), JSON.stringify(bigger), 'utf8')

    assert.equal(api.outbound({ dataDir: dir, jotDir: dir }).unreviewed, 1)

    api.refreshOutbound({ dataDir: dir, jotDir: dir })
    const after = api.outbound({ dataDir: dir, jotDir: dir })
    assert.equal(after.unreviewed, 0)
    assert.deepEqual(after.sending, [], 'and it arrived switched off')
  })
})
