import test from 'node:test'
import assert from 'node:assert/strict'

import { Config, apply } from '../lib/index.js'

test('host Config exposes volatile defaults and validates all settings', () => {
  const defaults = Config({})
  assert.equal(defaults.focusMinutes.get(), 25)
  assert.equal(defaults.breakMinutes.get(), 5)
  assert.equal(defaults.focusColor.get(), '#9ca3af')
  assert.equal(defaults.breakColor.get(), '#ef4444')
  assert.equal(defaults.focusOpacity.get(), 0.1)
  assert.equal(defaults.breakOpacity.get(), 0.3)
  assert.equal(defaults.fontFamily.get(), '等线')

  const custom = Config({
    focusMinutes: 50,
    breakMinutes: 10,
    focusColor: '#123456',
    breakColor: '#ABCDEF',
    focusOpacity: 0.45,
    breakOpacity: 0,
    fontFamily: 'Noto Sans CJK SC',
  })
  assert.equal(custom.focusMinutes.get(), 50)
  assert.equal(custom.breakMinutes.get(), 10)
  assert.equal(custom.focusColor.get(), '#123456')
  assert.equal(custom.breakColor.get(), '#ABCDEF')
  assert.equal(custom.focusOpacity.get(), 0.45)
  assert.equal(custom.breakOpacity.get(), 0)
  assert.equal(custom.fontFamily.get(), 'Noto Sans CJK SC')
  assert.throws(() => Config({ focusMinutes: 0, breakMinutes: 5 }))
  assert.throws(() => Config({ focusMinutes: 25, breakMinutes: 241 }))
  assert.throws(() => Config({ focusMinutes: 1.5, breakMinutes: 5 }))
  assert.throws(() => Config({ focusColor: 'gray' }))
  assert.throws(() => Config({ breakColor: '#fff' }))
  assert.throws(() => Config({ focusOpacity: -0.01 }))
  assert.throws(() => Config({ breakOpacity: 1.01 }))
  assert.throws(() => Config({ fontFamily: 'Arial, sans-serif' }))
  assert.throws(() => Config({ fontFamily: '"Arial"' }))
  assert.throws(() => Config({ fontFamily: '' }))
})

test('host applies the custom-settings policy in the optional settings scope', () => {
  const fiber = {}
  let configured = null
  const child = {
    settings: {
      configure(options, owner) {
        configured = { options, owner }
        return () => {}
      },
    },
    effect(callback) {
      callback()
    },
  }
  const ctx = {
    fiber,
    inject(dependencies, callback) {
      assert.deepEqual(dependencies, ['settings'])
      callback(child)
    },
  }
  apply(ctx)
  assert.deepEqual(configured, { options: { auto: false }, owner: fiber })
})
