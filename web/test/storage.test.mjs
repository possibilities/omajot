import { test } from 'node:test'
import assert from 'node:assert/strict'
import { storageState, askPersist, persistPrompts, storageText } from '../src/storage.js'

const nav = (persisted, grant) => {
  const calls = { persist: 0 }
  return {
    calls,
    storage: {
      persisted: async () => persisted,
      persist: async () => { calls.persist++; persisted = grant; return grant },
    },
  }
}

test('storageState reads persisted()', async () => {
  assert.equal(await storageState(nav(true)), 'persisted')
  assert.equal(await storageState(nav(false)), 'best-effort')
  assert.equal(await storageState({}), 'unknown')
  assert.equal(await storageState({ storage: { persisted: async () => { throw new Error('x') } } }), 'unknown')
})

test('askPersist asks only when not persisted yet', async () => {
  const already = nav(true, true)
  assert.equal(await askPersist(already), 'persisted')
  assert.equal(already.calls.persist, 0)
  const granted = nav(false, true)
  assert.equal(await askPersist(granted), 'persisted')
  assert.equal(granted.calls.persist, 1)
  assert.equal(await askPersist(nav(false, false)), 'best-effort')
  assert.equal(await askPersist({}), 'unknown')
})

test('only Firefox prompts', () => {
  assert.equal(persistPrompts('Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0'), true)
  assert.equal(persistPrompts('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'), false)
  assert.equal(persistPrompts('Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1'), false)
})

test('storageText says that the hub copy is safe unless storage is kept', () => {
  assert.match(storageText('persisted'), /keeps the notes/)
  assert.match(storageText('best-effort'), /reached the hub is safe/)
  assert.match(storageText('unknown'), /reached the hub is safe/)
})
