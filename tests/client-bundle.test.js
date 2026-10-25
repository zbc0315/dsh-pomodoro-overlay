import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

import { STATE_KEY } from '../src/browser-store.js'

test('built client loads, auto-starts after config readiness and cleans up', async () => {
  const code = await readFile(new URL('../client/client.js', import.meta.url), 'utf8')
  const listeners = new Map()
  const values = new Map()
  const timers = new Map()
  let timerId = 0
  let exported
  let removedStyle = false
  const style = {
    setAttribute() {},
    remove() { removedStyle = true },
  }
  const documentRef = {
    hidden: false,
    head: { appendChild() {} },
    createElement(name) {
      assert.equal(name, 'style')
      return style
    },
    addEventListener(type, listener) { listeners.set(`document:${type}`, listener) },
    removeEventListener(type) { listeners.delete(`document:${type}`) },
  }
  const windowRef = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
    __ModuleLoader__: {
      load({ id, factory }) {
        assert.equal(id, 'dsh-pomodoro-overlay')
        exported = factory((name) => {
          assert.equal(name, 'react')
          return { createElement: () => ({}) }
        })
      },
    },
    addEventListener(type, listener) { listeners.set(`window:${type}`, listener) },
    removeEventListener(type) { listeners.delete(`window:${type}`) },
    setInterval(callback) {
      const id = ++timerId
      timers.set(id, callback)
      return id
    },
    clearInterval(id) { timers.delete(id) },
  }
  vm.runInNewContext(code, { window: windowRef, document: documentRef, console })
  assert.equal(exported.name, 'dsh-pomodoro-overlay')
  assert.deepEqual(Array.from(exported.inject), ['slots', 'configForms'])

  const form = {
    getSnapshot: () => ({
      status: 'ready',
      value: { focusMinutes: 50, breakMinutes: 10 },
      revision: 1,
      writable: true,
    }),
    subscribe: () => () => {},
  }
  const effects = []
  const registrations = []
  const ctx = {
    configForms: {
      get(id) {
        assert.equal(id, 'pomodoro-overlay')
        return form
      },
    },
    effect(callback) {
      const dispose = callback()
      if (dispose) effects.push(dispose)
    },
    slots: {
      inject(name, callback) { callback() },
      register(options, component) {
        registrations.push({ options, component })
        return () => {}
      },
    },
    logger: { error() {} },
  }
  exported.apply(ctx)
  assert.equal(registrations.length, 2)
  assert.deepEqual(registrations.map((entry) => entry.options.name), [
    'shell.overlay',
    'settings.section',
  ])
  assert.equal(registrations[1].options.id, 'pomodoro')
  assert.equal(registrations[1].options.label, '番茄钟')
  assert(values.has(STATE_KEY), 'first ready config must auto-create persisted focus state')
  const state = JSON.parse(values.get(STATE_KEY))
  assert.equal(state.phase, 'focus')
  assert.equal(state.durationMs, 50 * 60_000)
  assert.equal(timers.size, 1)

  for (const dispose of effects.reverse()) dispose()
  assert.equal(removedStyle, true)
  assert.equal(timers.size, 0)
  assert.equal(listeners.size, 0)
})
