import test from 'node:test'
import assert from 'node:assert/strict'

import {
  BREAK,
  DEFAULT_CONFIG,
  FOCUS,
  MINUTE_MS,
  configFromJSON,
  createRunningState,
  durationForPhase,
  formatRemaining,
  isValidState,
  otherPhase,
  parseConfig,
  pauseState,
  remainingAt,
  resetState,
  resumeState,
  settleState,
  skipState,
  stateFromJSON,
} from '../src/timer-core.js'

const T0 = 1_000_000

test('configuration accepts integer minutes and rejects invalid values', () => {
  assert.deepEqual(parseConfig({ focusMinutes: '50', breakMinutes: 10 }), {
    ...DEFAULT_CONFIG,
    focusMinutes: 50,
    breakMinutes: 10,
  })
  for (const value of [0, -1, 1.5, 241, '', null, true, Number.NaN, Infinity]) {
    assert.throws(() => parseConfig({ focusMinutes: value, breakMinutes: 5 }))
    assert.throws(() => parseConfig({ focusMinutes: 25, breakMinutes: value }))
  }
  assert.deepEqual(configFromJSON('{broken'), DEFAULT_CONFIG)
  assert.deepEqual(configFromJSON('{"focusMinutes":50,"breakMinutes":0}'), {
    ...DEFAULT_CONFIG,
    focusMinutes: 50,
    breakMinutes: 5,
  })
})

test('appearance settings accept hex colors and opacity while preserving legacy configs', () => {
  assert.equal(DEFAULT_CONFIG.focusOpacity, 0.1)
  assert.equal(DEFAULT_CONFIG.breakOpacity, 0.3)
  assert.equal(DEFAULT_CONFIG.fontFamily, '等线')
  const custom = parseConfig({
    focusMinutes: 25,
    breakMinutes: 5,
    focusColor: '#123ABC',
    breakColor: '#fedcba',
    focusOpacity: '0.45',
    breakOpacity: 0,
    fontFamily: 'Noto Sans CJK SC',
  })
  assert.equal(custom.focusColor, '#123ABC')
  assert.equal(custom.breakColor, '#fedcba')
  assert.equal(custom.focusOpacity, 0.45)
  assert.equal(custom.breakOpacity, 0)
  assert.equal(custom.fontFamily, 'Noto Sans CJK SC')
  assert.deepEqual(parseConfig({ focusMinutes: 25, breakMinutes: 5 }), DEFAULT_CONFIG)
  for (const focusColor of ['red', '#12345', '#1234567', 123456, null]) {
    assert.throws(() => parseConfig({ focusMinutes: 25, breakMinutes: 5, focusColor }))
  }
  for (const breakOpacity of [-0.01, 1.01, '', Number.NaN, Infinity]) {
    assert.throws(() => parseConfig({ focusMinutes: 25, breakMinutes: 5, breakOpacity }))
  }
  for (const fontFamily of ['', '   ', 'Arial, sans-serif', '"Arial"', 'Arial; color:red', null, 'A'.repeat(81)]) {
    assert.throws(() => parseConfig({ focusMinutes: 25, breakMinutes: 5, fontFamily }))
  }
  const recovered = configFromJSON('{"focusColor":"bad","breakOpacity":2,"fontFamily":"Arial, sans-serif"}')
  assert.equal(recovered.focusColor, DEFAULT_CONFIG.focusColor)
  assert.equal(recovered.breakOpacity, DEFAULT_CONFIG.breakOpacity)
  assert.equal(recovered.fontFamily, DEFAULT_CONFIG.fontFamily)
})

test('phase and duration helpers validate their input', () => {
  assert.equal(otherPhase(FOCUS), BREAK)
  assert.equal(otherPhase(BREAK), FOCUS)
  assert.throws(() => otherPhase('invalid'))
  assert.throws(() => durationForPhase('invalid', DEFAULT_CONFIG))
  assert.equal(durationForPhase(FOCUS, DEFAULT_CONFIG), 25 * MINUTE_MS)
  assert.equal(durationForPhase(BREAK, DEFAULT_CONFIG), 5 * MINUTE_MS)
})

test('first state starts running immediately and remaining uses absolute time', () => {
  const state = createRunningState(FOCUS, DEFAULT_CONFIG, T0)
  assert.equal(state.running, true)
  assert.equal(state.phase, FOCUS)
  assert.equal(state.endsAt, T0 + 25 * MINUTE_MS)
  assert.equal(remainingAt(state, T0 + 60_000), 24 * MINUTE_MS)
  assert.equal(remainingAt(state, T0 - 60_000), 25 * MINUTE_MS)
})

test('exact boundary and boundary + 1ms each advance once', () => {
  const initial = createRunningState(FOCUS, DEFAULT_CONFIG, T0)
  const atBoundary = settleState(initial, DEFAULT_CONFIG, initial.endsAt)
  assert.equal(atBoundary.phase, BREAK)
  assert.equal(atBoundary.startedAt, initial.endsAt)
  assert.equal(atBoundary.endsAt, initial.endsAt + 5 * MINUTE_MS)

  const after = settleState(initial, DEFAULT_CONFIG, initial.endsAt + 1)
  assert.deepEqual(after, { ...atBoundary, updatedAt: initial.endsAt + 1 })
  assert.equal(settleState(atBoundary, DEFAULT_CONFIG, initial.endsAt), atBoundary)
})

test('wall-clock recovery lands in the correct phase after several cycles', () => {
  const initial = createRunningState(FOCUS, DEFAULT_CONFIG, T0)
  const at65 = settleState(initial, DEFAULT_CONFIG, T0 + 65 * MINUTE_MS)
  assert.equal(at65.phase, FOCUS)
  assert.equal(at65.startedAt, T0 + 60 * MINUTE_MS)
  assert.equal(at65.endsAt, T0 + 85 * MINUTE_MS)
  assert.equal(remainingAt(at65, T0 + 65 * MINUTE_MS), 20 * MINUTE_MS)

  const at58 = settleState(initial, DEFAULT_CONFIG, T0 + 58 * MINUTE_MS)
  assert.equal(at58.phase, BREAK)
  assert.equal(at58.startedAt, T0 + 55 * MINUTE_MS)
  assert.equal(at58.endsAt, T0 + 60 * MINUTE_MS)

  const repeated = settleState(at65, DEFAULT_CONFIG, T0 + 65 * MINUTE_MS)
  assert.equal(repeated, at65)
})

test('very long offline intervals are skipped arithmetically', () => {
  const initial = createRunningState(FOCUS, DEFAULT_CONFIG, T0)
  const cycles = 100_000
  const now = T0 + cycles * 30 * MINUTE_MS
  const settled = settleState(initial, DEFAULT_CONFIG, now)
  assert.equal(settled.phase, FOCUS)
  assert.equal(settled.startedAt, now)
  assert.equal(settled.endsAt, now + 25 * MINUTE_MS)
})

test('new settings apply at the next phase without changing the current deadline', () => {
  const nextConfig = { focusMinutes: 50, breakMinutes: 10 }
  const initial = createRunningState(FOCUS, DEFAULT_CONFIG, T0)
  const sameBeforeBoundary = settleState(initial, nextConfig, T0 + 10 * MINUTE_MS)
  assert.equal(sameBeforeBoundary, initial)

  const inBreak = settleState(initial, nextConfig, T0 + 30 * MINUTE_MS)
  assert.equal(inBreak.phase, BREAK)
  assert.equal(inBreak.startedAt, T0 + 25 * MINUTE_MS)
  assert.equal(inBreak.endsAt, T0 + 35 * MINUTE_MS)

  const inFocus = settleState(inBreak, nextConfig, T0 + 36 * MINUTE_MS)
  assert.equal(inFocus.phase, FOCUS)
  assert.equal(inFocus.endsAt, T0 + 85 * MINUTE_MS)
})

test('pause, resume, skip and reset preserve explicit semantics', () => {
  const initial = createRunningState(FOCUS, DEFAULT_CONFIG, T0)
  const paused = pauseState(initial, DEFAULT_CONFIG, T0 + 60_000)
  assert.equal(paused.running, false)
  assert.equal(paused.endsAt, null)
  assert.equal(paused.remainingMs, 24 * MINUTE_MS)
  assert.equal(remainingAt(paused, T0 + 10 * MINUTE_MS), 24 * MINUTE_MS)

  const resumed = resumeState(paused, DEFAULT_CONFIG, T0 + 10 * MINUTE_MS)
  assert.equal(resumed.running, true)
  assert.equal(resumed.endsAt, T0 + 34 * MINUTE_MS)

  const skipped = skipState(paused, DEFAULT_CONFIG, T0 + 11 * MINUTE_MS)
  assert.equal(skipped.phase, BREAK)
  assert.equal(skipped.running, true)
  assert.equal(skipped.endsAt, T0 + 16 * MINUTE_MS)

  const reset = resetState({ focusMinutes: 50, breakMinutes: 10 }, T0 + 12 * MINUTE_MS)
  assert.equal(reset.phase, FOCUS)
  assert.equal(reset.endsAt, T0 + 62 * MINUTE_MS)
})

test('a zero-length paused remainder resumes by settling the next phase', () => {
  const initial = createRunningState(FOCUS, DEFAULT_CONFIG, T0)
  const paused = pauseState(initial, DEFAULT_CONFIG, initial.endsAt)
  // pauseState settles first, so construct the legal zero-paused edge directly.
  const zero = { ...paused, phase: FOCUS, remainingMs: 0, durationMs: 25 * MINUTE_MS }
  const resumed = resumeState(zero, DEFAULT_CONFIG, T0 + 50 * MINUTE_MS)
  assert.equal(resumed.phase, BREAK)
  assert.equal(resumed.running, true)
  assert.equal(resumed.endsAt, T0 + 55 * MINUTE_MS)
})

test('stored state validation rejects corruption and old versions', () => {
  const valid = createRunningState(FOCUS, DEFAULT_CONFIG, T0)
  assert.equal(isValidState(valid), true)
  assert.deepEqual(stateFromJSON(JSON.stringify(valid)), valid)
  assert.equal(stateFromJSON('{broken'), null)
  assert.equal(stateFromJSON('null'), null)
  assert.equal(stateFromJSON(JSON.stringify({ ...valid, version: 0 })), null)
  assert.equal(stateFromJSON(JSON.stringify({ ...valid, phase: 'other' })), null)
  assert.equal(stateFromJSON(JSON.stringify({ ...valid, endsAt: -1 })), null)
  assert.equal(stateFromJSON(JSON.stringify({ ...valid, endsAt: null })), null)
  assert.equal(stateFromJSON(JSON.stringify({ ...valid, endsAt: valid.endsAt + 1 })), null)
})

test('remaining display rounds upward and supports long durations', () => {
  assert.equal(formatRemaining(0), '00:00')
  assert.equal(formatRemaining(1), '00:01')
  assert.equal(formatRemaining(1000), '00:01')
  assert.equal(formatRemaining(1001), '00:02')
  assert.equal(formatRemaining(60_000), '01:00')
  assert.equal(formatRemaining(240 * MINUTE_MS), '240:00')
})
