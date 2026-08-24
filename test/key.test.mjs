import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { keyPath, noKeyMessage, readKey } from '../src/domain/key.js'

/**
 * @template T
 * @param {(dir: string) => T} body
 * @returns {T}
 */
function scratch(body) {
  const dir = mkdtempSync(join(tmpdir(), 'brief-key-'))
  const before = { key: process.env.GEMINI_API_KEY, file: process.env.GEMINI_KEY_FILE }
  delete process.env.GEMINI_API_KEY
  delete process.env.GEMINI_KEY_FILE
  try {
    return body(dir)
  } finally {
    if (before.key === undefined) {
      delete process.env.GEMINI_API_KEY
    } else {
      process.env.GEMINI_API_KEY = before.key
    }
    if (before.file === undefined) {
      delete process.env.GEMINI_KEY_FILE
    } else {
      process.env.GEMINI_KEY_FILE = before.file
    }
    rmSync(dir, { recursive: true, force: true })
  }
}

test('no key anywhere reads as no key, not as an empty one', () => {
  scratch((dir) => {
    assert.equal(readKey(dir), null)
  })
})

test('the environment wins, so a shell can override the file', () => {
  scratch((dir) => {
    writeFileSync(keyPath(dir), 'from-the-file', 'utf8')
    process.env.GEMINI_API_KEY = 'from-the-env'
    assert.deepEqual(readKey(dir), { key: 'from-the-env', source: 'GEMINI_API_KEY' })
  })
})

test('a key file in the data directory is found', () => {
  scratch((dir) => {
    writeFileSync(keyPath(dir), 'abc123', 'utf8')
    assert.equal(readKey(dir)?.key, 'abc123')
  })
})

test('a trailing newline is trimmed, because pasting into an editor adds one', () => {
  scratch((dir) => {
    writeFileSync(keyPath(dir), 'abc123\n', 'utf8')
    assert.equal(readKey(dir)?.key, 'abc123')
  })
})

test('an empty key file is the same as no key', () => {
  scratch((dir) => {
    // Otherwise the request goes out with an empty credential and the error
    // comes back from Google, which is a much worse place to learn it.
    writeFileSync(keyPath(dir), '   \n', 'utf8')
    assert.equal(readKey(dir), null)
  })
})

test('GEMINI_KEY_FILE points the key somewhere unsynced', () => {
  scratch((dir) => {
    const elsewhere = join(dir, 'not-the-data-dir.key')
    writeFileSync(elsewhere, 'held-apart', 'utf8')
    process.env.GEMINI_KEY_FILE = elsewhere
    assert.deepEqual(readKey(dir), { key: 'held-apart', source: 'GEMINI_KEY_FILE' })
  })
})

test('a named file that is not there falls through rather than failing', () => {
  scratch((dir) => {
    writeFileSync(keyPath(dir), 'the-fallback', 'utf8')
    process.env.GEMINI_KEY_FILE = join(dir, 'nope.key')
    assert.equal(readKey(dir)?.key, 'the-fallback')
  })
})

test('the message says a subscription is not API access', () => {
  // The obvious wrong assumption, and it costs an hour of looking for a page
  // that does not exist.
  assert.match(noKeyMessage('D:\\Dropbox\\brief'), /NOT the same thing as a Gemini subscription/)
  assert.match(noKeyMessage('D:\\Dropbox\\brief'), /gemini\.key/)
})

test('nothing in the module ever writes a key', () => {
  // Load-bearing: a credential must never end up somewhere the user did not
  // choose, and the easiest way to guarantee that is to have no writer at all.
  const source = readFileSync(new URL('../src/domain/key.js', import.meta.url), 'utf8')
  assert.equal(/writeFileSync|appendFileSync|createWriteStream/.test(source), false)
})
