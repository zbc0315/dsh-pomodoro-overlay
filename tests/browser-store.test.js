import test from 'node:test'
import assert from 'node:assert/strict'

import { createPomodoroStore, STATE_KEY } from '../src/browser-store.js'
import { BREAK, DEFAULT_CONFIG, FOCUS, MINUTE_MS } from '../src/timer-core.js'

const T0 = 1_000_000

class FakeStorage {
  constructor() {
    this.values = new Map()
    this.throwGet = false
    this.throwSet = false
  }

  getItem(key) {
    if (this.throwGet) throw new Error('denied')
    return this.values.has(key) ? this.values.get(key) : null
  }

  setItem(key, value) {
    if (this.throwSet) throw new Error('quota')
    this.values.set(key, String(value))
  }
}

class FakeEvents {
  constructor() {
    this.listeners = new Map()
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type).add(listener)
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener)
  }

  dispatch(type, event = {}) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event)
  }

  count(type) {
    return this.listeners.get(type)?.size ?? 0
  }
}

class FakeTimers {
  constructor() {
    this.nextId = 0
    this.callbacks = new Map()
  }

  setInterval(callback) {
    const id = ++this.nextId
    this.callbacks.set(id, callback)
    return id
  }

  clearInterval(id) {
    this.callbacks.delete(id)
  }

  fire() {
    for (const callback of [...this.callbacks.values()]) callback()
  }
}

function harness({ config = DEFAULT_CONFIG, storage = new FakeStorage(), clock = { value: T0 } } = {}) {
  const events = new FakeEvents()
  const documentRef = new FakeEvents()
  documentRef.hidden = false
  const timers = new FakeTimers()
  const store = createPomodoroStore({
    initialConfig: config,
    storage,
    clock: undefined,
    now: () => clock.value,
    events,
    document: documentRef,
    timers,
  })
  return { store, storage, clock, events, documentRef, timers }
}

test('store waits for start, then uses the already-ready native configuration', () => {
  const h = harness({ config: { focusMinutes: 50, breakMinutes: 10 } })
  assert.equal(h.store.getSnapshot().active, false)
  h.store.start()
  const snapshot = h.store.getSnapshot()
  assert.equal(snapshot.active, true)
  assert.equal(snapshot.phase, FOCUS)
  assert.equal(snapshot.running, true)
  assert.equal(snapshot.text, '50:00')
  assert.equal(snapshot.state.endsAt, T0 + 50 * MINUTE_MS)
  h.store.dispose()
})

test('timer ticks render from absolute time and automatically cycle', () => {
  const h = harness()
  h.store.start()
  h.clock.value += 1000
  h.timers.fire()
  assert.equal(h.store.getSnapshot().text, '24:59')

  h.clock.value = T0 + 25 * MINUTE_MS
  h.timers.fire()
  assert.equal(h.store.getSnapshot().phase, BREAK)
  assert.equal(h.store.getSnapshot().text, '05:00')

  h.clock.value = T0 + 30 * MINUTE_MS
  h.events.dispatch('focus')
  assert.equal(h.store.getSnapshot().phase, FOCUS)
  assert.equal(h.store.getSnapshot().text, '25:00')
  h.store.dispose()
})

test('reopening after multiple offline cycles restores the wall-clock phase once', () => {
  const clock = { value: T0 }
  const storage = new FakeStorage()
  const first = harness({ clock, storage })
  first.store.start()
  first.store.dispose()

  clock.value = T0 + 65 * MINUTE_MS
  const reopened = harness({ clock, storage })
  reopened.store.start()
  assert.equal(reopened.store.getSnapshot().phase, FOCUS)
  assert.equal(reopened.store.getSnapshot().text, '20:00')
  assert.equal(reopened.store.getSnapshot().state.startedAt, T0 + 60 * MINUTE_MS)
  const endsAt = reopened.store.getSnapshot().state.endsAt
  reopened.store.refresh()
  assert.equal(reopened.store.getSnapshot().state.endsAt, endsAt)
  reopened.store.dispose()
})

test('pause, resume, skip and reset are persisted and do not drift', () => {
  const h = harness()
  h.store.start()
  h.clock.value += 60_000
  h.store.pause()
  assert.equal(h.store.getSnapshot().running, false)
  assert.equal(h.store.getSnapshot().text, '24:00')

  h.clock.value += 10 * MINUTE_MS
  h.timers.fire()
  assert.equal(h.store.getSnapshot().text, '24:00')
  h.store.resume()
  assert.equal(h.store.getSnapshot().state.endsAt, h.clock.value + 24 * MINUTE_MS)

  h.store.skip()
  assert.equal(h.store.getSnapshot().phase, BREAK)
  assert.equal(h.store.getSnapshot().running, true)
  h.store.reset()
  assert.equal(h.store.getSnapshot().phase, FOCUS)
  assert.equal(h.store.getSnapshot().text, '25:00')
  h.store.dispose()
})

test('native config updates preserve the current phase and apply next phase', () => {
  const h = harness()
  h.store.start()
  const originalEndsAt = h.store.getSnapshot().state.endsAt
  h.store.setConfig({ focusMinutes: 50, breakMinutes: 10 })
  assert.equal(h.store.getSnapshot().state.endsAt, originalEndsAt)

  h.clock.value = originalEndsAt
  h.timers.fire()
  assert.equal(h.store.getSnapshot().phase, BREAK)
  assert.equal(h.store.getSnapshot().text, '10:00')

  h.clock.value = T0 + 35 * MINUTE_MS
  h.timers.fire()
  assert.equal(h.store.getSnapshot().phase, FOCUS)
  assert.equal(h.store.getSnapshot().text, '50:00')
  assert.throws(() => h.store.setConfig({ focusMinutes: 0, breakMinutes: 10 }))
  assert.deepEqual(h.store.getSnapshot().config, { ...DEFAULT_CONFIG, focusMinutes: 50, breakMinutes: 10 })
  h.store.dispose()
})

test('appearance updates apply immediately without resetting the running timeline', () => {
  const h = harness()
  h.store.start()
  const before = h.store.getSnapshot()
  h.store.setConfig({
    ...DEFAULT_CONFIG,
    focusColor: '#123456',
    focusOpacity: 0.45,
    breakColor: '#abcdef',
    breakOpacity: 0.65,
    fontFamily: 'Courier New',
  })
  const after = h.store.getSnapshot()
  assert.equal(after.phase, before.phase)
  assert.equal(after.state, before.state)
  assert.equal(after.state.endsAt, before.state.endsAt)
  assert.equal(after.config.focusColor, '#123456')
  assert.equal(after.config.focusOpacity, 0.45)
  assert.equal(after.config.breakColor, '#abcdef')
  assert.equal(after.config.breakOpacity, 0.65)
  assert.equal(after.config.fontFamily, 'Courier New')
  h.store.dispose()
})

test('storage events synchronize phase and deadline without independent ticking', () => {
  const clock = { value: T0 }
  const storage = new FakeStorage()
  const first = harness({ clock, storage })
  const second = harness({ clock, storage })
  first.store.start()
  second.store.start()

  first.store.skip()
  second.events.dispatch('storage', { key: STATE_KEY, newValue: storage.getItem(STATE_KEY) })
  assert.equal(second.store.getSnapshot().phase, BREAK)
  assert.equal(second.store.getSnapshot().state.endsAt, first.store.getSnapshot().state.endsAt)
  first.store.dispose()
  second.store.dispose()
})

test('corrupt persisted JSON safely falls back to a fresh automatic focus', () => {
  const storage = new FakeStorage()
  storage.setItem(STATE_KEY, '{broken')
  const h = harness({ storage })
  h.store.start()
  assert.equal(h.store.getSnapshot().active, true)
  assert.equal(h.store.getSnapshot().phase, FOCUS)
  assert.equal(h.store.getSnapshot().text, '25:00')
  assert.doesNotThrow(() => JSON.parse(storage.getItem(STATE_KEY)))
  h.store.dispose()
})

test('storage read/write failures leave a working in-memory automatic cycle', () => {
  const storage = new FakeStorage()
  storage.throwGet = true
  storage.throwSet = true
  const h = harness({ storage })
  h.store.start()
  assert.equal(h.store.getSnapshot().active, true)
  assert.equal(h.store.getSnapshot().storageAvailable, false)

  h.clock.value = T0 + 25 * MINUTE_MS
  h.timers.fire()
  assert.equal(h.store.getSnapshot().phase, BREAK)
  assert.equal(h.store.getSnapshot().text, '05:00')
  assert.equal(h.store.getSnapshot().storageAvailable, false)
  h.store.dispose()
})

test('unchanged ticks do not notify React and dispose cleans all listeners', () => {
  const h = harness()
  let notifications = 0
  const unsubscribe = h.store.subscribe(() => { notifications += 1 })
  h.store.start()
  const afterStart = notifications
  h.clock.value += 100
  h.timers.fire()
  assert.equal(notifications, afterStart)
  h.clock.value += 900
  h.timers.fire()
  assert.equal(notifications, afterStart + 1)

  h.store.dispose()
  assert.equal(h.timers.callbacks.size, 0)
  assert.equal(h.events.count('storage'), 0)
  assert.equal(h.events.count('focus'), 0)
  assert.equal(h.events.count('pageshow'), 0)
  assert.equal(h.documentRef.count('visibilitychange'), 0)
  unsubscribe()
})

test('config changes first settle an expired phase with the old durations', () => {
  const h = harness()
  h.store.start()
  h.clock.value = T0 + 26 * MINUTE_MS
  h.store.setConfig({ focusMinutes: 50, breakMinutes: 10 })
  const snapshot = h.store.getSnapshot()
  assert.equal(snapshot.phase, BREAK)
  assert.equal(snapshot.text, '04:00')
  assert.equal(snapshot.state.durationMs, 5 * MINUTE_MS)
  assert.equal(snapshot.state.endsAt, T0 + 30 * MINUTE_MS)
  h.store.dispose()
})

test('skip first settles the wall-clock phase instead of skipping a stale phase', () => {
  const h = harness()
  h.store.start()
  h.clock.value = T0 + 26 * MINUTE_MS
  h.store.skip()
  const snapshot = h.store.getSnapshot()
  assert.equal(snapshot.phase, FOCUS)
  assert.equal(snapshot.text, '25:00')
  assert.equal(snapshot.state.startedAt, T0 + 26 * MINUTE_MS)
  assert.equal(snapshot.state.endsAt, T0 + 51 * MINUTE_MS)
  h.store.dispose()
})

test('an older storage event cannot overwrite a newer local action', () => {
  const h = harness()
  h.store.start()
  const stale = h.storage.getItem(STATE_KEY)
  h.clock.value += 1000
  h.store.skip()
  const current = h.store.getSnapshot().state
  h.events.dispatch('storage', { key: STATE_KEY, newValue: stale })
  assert.equal(h.store.getSnapshot().phase, BREAK)
  assert.equal(h.store.getSnapshot().state.endsAt, current.endsAt)
  h.store.dispose()
})

test('actions after dispose neither change state nor write persistence', () => {
  const h = harness()
  h.store.start()
  h.store.dispose()
  assert.equal(h.store.getSnapshot().active, false)
  const persisted = h.storage.getItem(STATE_KEY)
  h.store.pause()
  h.store.resume()
  h.store.skip()
  h.store.reset()
  h.store.setConfig({ focusMinutes: 50, breakMinutes: 10 })
  assert.equal(h.storage.getItem(STATE_KEY), persisted)
  assert.equal(h.timers.callbacks.size, 0)
})

test('resume on an expired running snapshot settles to the actual phase', () => {
  const h = harness()
  h.store.start()
  h.clock.value = T0 + 26 * MINUTE_MS
  h.store.resume()
  const snapshot = h.store.getSnapshot()
  assert.equal(snapshot.phase, BREAK)
  assert.equal(snapshot.running, true)
  assert.equal(snapshot.text, '04:00')
  assert.equal(snapshot.state.endsAt, T0 + 30 * MINUTE_MS)
  h.store.dispose()
})

test('a paused snapshot remains paused and fixed after store reconstruction', () => {
  const clock = { value: T0 }
  const storage = new FakeStorage()
  const first = harness({ clock, storage })
  first.store.start()
  clock.value += 60_000
  first.store.pause()
  const remaining = first.store.getSnapshot().state.remainingMs
  first.store.dispose()

  clock.value += 10 * MINUTE_MS
  const reopened = harness({ clock, storage })
  reopened.store.start()
  assert.equal(reopened.store.getSnapshot().phase, FOCUS)
  assert.equal(reopened.store.getSnapshot().running, false)
  assert.equal(reopened.store.getSnapshot().state.remainingMs, remaining)
  assert.equal(reopened.store.getSnapshot().text, '24:00')
  clock.value += 10 * MINUTE_MS
  reopened.timers.fire()
  assert.equal(reopened.store.getSnapshot().text, '24:00')
  reopened.store.dispose()
})
