import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CHAT_FLOW_SELECTOR,
  CHAT_SELECTOR,
  COMPOSER_SELECTOR,
  chatOverlayRect,
  findChatOverlay,
} from '../src/chat-geometry.js'

function rect(left, top, width, height) {
  return { left, top, width, height, right: left + width, bottom: top + height }
}

function fakeChat({
  body = rect(200, 100, 800, 800),
  composer = rect(200, 700, 800, 200),
  flow = true,
  connected = true,
  hidden = false,
} = {}) {
  const flowNode = flow ? {} : null
  const composerNode = composer ? { getBoundingClientRect: () => composer } : null
  return {
    isConnected: connected,
    closest: () => hidden ? {} : null,
    querySelector(selector) {
      if (selector === CHAT_FLOW_SELECTOR) return flowNode
      if (selector === COMPOSER_SELECTOR) return composerNode
      return null
    },
    getBoundingClientRect: () => body,
  }
}

test('overlay uses chat bounds and excludes the composer', () => {
  const value = chatOverlayRect(fakeChat())
  assert.deepEqual(value, {
    left: 200,
    top: 100,
    right: 1000,
    bottom: 700,
    width: 800,
    height: 600,
  })
})

test('composer below the viewport is clamped to the chat bottom', () => {
  const value = chatOverlayRect(fakeChat({ composer: rect(200, 1000, 800, 200) }))
  assert.equal(value.bottom, 900)
  assert.equal(value.height, 800)
})

test('missing composer leaves the full chat rectangle', () => {
  const value = chatOverlayRect(fakeChat({ composer: null }))
  assert.equal(value.bottom, 900)
  assert.equal(value.height, 800)
})

test('invalid or inactive chat geometry fails closed', () => {
  assert.equal(chatOverlayRect(null), null)
  assert.equal(chatOverlayRect(fakeChat({ flow: false })), null)
  assert.equal(chatOverlayRect(fakeChat({ connected: false })), null)
  assert.equal(chatOverlayRect(fakeChat({ hidden: true })), null)
  assert.equal(chatOverlayRect(fakeChat({ body: rect(0, 0, 0, 0) })), null)
  assert.equal(chatOverlayRect(fakeChat({ body: rect(0, 0, 100, 500) })), null)
  assert.equal(chatOverlayRect(fakeChat({ composer: rect(0, 50, 100, 50) })), null)
})

test('largest visible conversation wins over embedded or invalid candidates', () => {
  const embedded = fakeChat({ body: rect(0, 0, 300, 300) })
  const main = fakeChat({ body: rect(300, 0, 1000, 900) })
  const inactive = fakeChat({ flow: false, body: rect(0, 0, 2000, 2000) })
  const documentRef = {
    querySelectorAll(selector) {
      assert.equal(selector, CHAT_SELECTOR)
      return [embedded, inactive, main]
    },
  }
  const match = findChatOverlay(documentRef)
  assert.equal(match.chat, main)
  assert.equal(match.rect.width, 1000)
})
