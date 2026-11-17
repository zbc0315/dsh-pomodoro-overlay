import test from 'node:test'
import assert from 'node:assert/strict'

import { viewportRect } from '../src/chat-geometry.js'

test('viewport rect spans the whole window', () => {
  const windowRef = { innerWidth: 1440, innerHeight: 900, document: { documentElement: { clientWidth: 1440, clientHeight: 900 } } }
  assert.deepEqual(viewportRect(windowRef), {
    left: 0,
    top: 0,
    right: 1440,
    bottom: 900,
    width: 1440,
    height: 900,
  })
})

test('viewport rect falls back to documentElement client size', () => {
  const windowRef = { document: { documentElement: { clientWidth: 800, clientHeight: 600 } } }
  const rect = viewportRect(windowRef)
  assert.equal(rect.width, 800)
  assert.equal(rect.height, 600)
})

test('viewport rect ignores DOM chat state and never fails closed', () => {
  const windowRef = { innerWidth: 380, innerHeight: 720 }
  const rect = viewportRect(windowRef)
  assert.equal(rect.width, 380)
  assert.equal(rect.height, 720)
})

test('viewport rect rejects missing or non-positive sizes', () => {
  assert.equal(viewportRect(null), null)
  assert.equal(viewportRect({}), null)
  assert.equal(viewportRect({ innerWidth: 0, innerHeight: 0 }), null)
  assert.equal(viewportRect({ innerWidth: -10, innerHeight: 100 }), null)
})
