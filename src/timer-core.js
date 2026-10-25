export const FOCUS = 'focus'
export const BREAK = 'break'
export const STATE_VERSION = 1
export const MIN_MINUTES = 1
export const MAX_MINUTES = 240
export const MINUTE_MS = 60_000

export const DEFAULT_CONFIG = Object.freeze({
  focusMinutes: 25,
  breakMinutes: 5,
  focusColor: '#9ca3af',
  breakColor: '#ef4444',
  focusOpacity: 0.1,
  breakOpacity: 0.3,
  fontFamily: '等线',
})

function numeric(value) {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim() !== '') return Number(value)
  return Number.NaN
}

export function isValidMinutes(value) {
  const parsed = numeric(value)
  return Number.isInteger(parsed) && parsed >= MIN_MINUTES && parsed <= MAX_MINUTES
}

export function isValidColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
}

export function isValidOpacity(value) {
  const parsed = numeric(value)
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
}

export function isValidFontFamily(value) {
  return typeof value === 'string' && value.length <= 80
    && /^[\p{L}\p{N}][\p{L}\p{N} _.-]*$/u.test(value)
}

/** Strict validation for an explicit settings save. */
export function parseConfig(value) {
  if (!isValidMinutes(value?.focusMinutes) || !isValidMinutes(value?.breakMinutes)) {
    throw new RangeError(`Durations must be integers from ${MIN_MINUTES} to ${MAX_MINUTES} minutes`)
  }
  const parsed = {
    focusMinutes: numeric(value.focusMinutes),
    breakMinutes: numeric(value.breakMinutes),
    focusColor: value.focusColor === undefined ? DEFAULT_CONFIG.focusColor : value.focusColor,
    breakColor: value.breakColor === undefined ? DEFAULT_CONFIG.breakColor : value.breakColor,
    focusOpacity: value.focusOpacity === undefined ? DEFAULT_CONFIG.focusOpacity : value.focusOpacity,
    breakOpacity: value.breakOpacity === undefined ? DEFAULT_CONFIG.breakOpacity : value.breakOpacity,
    fontFamily: value.fontFamily === undefined ? DEFAULT_CONFIG.fontFamily : value.fontFamily,
  }
  if (!isValidColor(parsed.focusColor) || !isValidColor(parsed.breakColor)) {
    throw new TypeError('Colors must use six-digit hex format (#rrggbb)')
  }
  if (!isValidOpacity(parsed.focusOpacity) || !isValidOpacity(parsed.breakOpacity)) {
    throw new RangeError('Opacity values must be between 0 and 1')
  }
  if (!isValidFontFamily(parsed.fontFamily)) {
    throw new TypeError('Font family must be a single installed font name')
  }
  parsed.focusOpacity = numeric(parsed.focusOpacity)
  parsed.breakOpacity = numeric(parsed.breakOpacity)
  return parsed
}

/** Non-throwing recovery for a browser-stored snapshot. */
export function sanitizeConfig(value) {
  return {
    focusMinutes: isValidMinutes(value?.focusMinutes)
      ? numeric(value.focusMinutes)
      : DEFAULT_CONFIG.focusMinutes,
    breakMinutes: isValidMinutes(value?.breakMinutes)
      ? numeric(value.breakMinutes)
      : DEFAULT_CONFIG.breakMinutes,
    focusColor: isValidColor(value?.focusColor) ? value.focusColor : DEFAULT_CONFIG.focusColor,
    breakColor: isValidColor(value?.breakColor) ? value.breakColor : DEFAULT_CONFIG.breakColor,
    focusOpacity: isValidOpacity(value?.focusOpacity)
      ? numeric(value.focusOpacity)
      : DEFAULT_CONFIG.focusOpacity,
    breakOpacity: isValidOpacity(value?.breakOpacity)
      ? numeric(value.breakOpacity)
      : DEFAULT_CONFIG.breakOpacity,
    fontFamily: isValidFontFamily(value?.fontFamily) ? value.fontFamily : DEFAULT_CONFIG.fontFamily,
  }
}

export function configFromJSON(text) {
  if (typeof text !== 'string' || text === '') return { ...DEFAULT_CONFIG }
  try {
    return sanitizeConfig(JSON.parse(text))
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function otherPhase(phase) {
  if (phase === FOCUS) return BREAK
  if (phase === BREAK) return FOCUS
  throw new TypeError(`Unknown Pomodoro phase: ${String(phase)}`)
}

export function durationForPhase(phase, config) {
  otherPhase(phase)
  const valid = parseConfig(config)
  return (phase === FOCUS ? valid.focusMinutes : valid.breakMinutes) * MINUTE_MS
}

function assertFinite(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite`)
}

export function createRunningState(phase, config, now, durationOverride) {
  otherPhase(phase)
  assertFinite(now, 'now')
  const durationMs = durationOverride ?? durationForPhase(phase, config)
  assertFinite(durationMs, 'durationMs')
  if (durationMs <= 0) throw new RangeError('durationMs must be positive')
  return {
    version: STATE_VERSION,
    phase,
    running: true,
    startedAt: now,
    endsAt: now + durationMs,
    durationMs,
    remainingMs: null,
    updatedAt: now,
  }
}

export function isValidState(value) {
  if (!value || value.version !== STATE_VERSION) return false
  if (value.phase !== FOCUS && value.phase !== BREAK) return false
  if (typeof value.running !== 'boolean') return false
  if (!Number.isFinite(value.startedAt) || !Number.isFinite(value.updatedAt)) return false
  if (!Number.isFinite(value.durationMs) || value.durationMs <= 0) return false
  if (value.running) {
    return Number.isFinite(value.endsAt)
      && value.endsAt >= 0
      && value.endsAt - value.startedAt === value.durationMs
      && value.remainingMs === null
  }
  return value.endsAt === null
    && Number.isFinite(value.remainingMs)
    && value.remainingMs >= 0
    && value.remainingMs <= value.durationMs
}

export function stateFromJSON(text) {
  if (typeof text !== 'string' || text === '') return null
  try {
    const value = JSON.parse(text)
    return isValidState(value) ? value : null
  } catch {
    return null
  }
}

/**
 * Advance a running state to the phase that should be active at `now`.
 * Expired boundaries retain their original timestamps, so reopening after a
 * long sleep lands on the correct wall-clock phase rather than restarting.
 */
export function settleState(state, config, now) {
  if (!isValidState(state)) throw new TypeError('Invalid Pomodoro state')
  const valid = parseConfig(config)
  assertFinite(now, 'now')
  if (!state.running || now < state.endsAt) return state

  const next = { ...state, updatedAt: now }
  let transitions = 0
  const cycleMs = (valid.focusMinutes + valid.breakMinutes) * MINUTE_MS

  while (now >= next.endsAt) {
    const boundary = next.endsAt
    next.phase = otherPhase(next.phase)
    next.startedAt = boundary
    next.durationMs = (next.phase === FOCUS ? valid.focusMinutes : valid.breakMinutes) * MINUTE_MS
    next.endsAt = boundary + next.durationMs
    next.remainingMs = null
    next.running = true
    transitions += 1

    // After two transitions both durations come from the current config.
    // Skip complete cycles arithmetically instead of iterating once per minute.
    if (transitions >= 2) {
      const cycles = Math.floor((now - next.startedAt) / cycleMs)
      if (cycles > 0) {
        next.startedAt += cycles * cycleMs
        next.endsAt += cycles * cycleMs
        transitions += cycles * 2
      }
    }
  }

  return next
}

export function remainingAt(state, now) {
  if (!isValidState(state)) throw new TypeError('Invalid Pomodoro state')
  assertFinite(now, 'now')
  if (!state.running) return state.remainingMs
  // A backwards wall-clock adjustment must not show more than a full phase.
  return Math.min(state.durationMs, Math.max(0, state.endsAt - now))
}

export function pauseState(state, config, now) {
  const settled = settleState(state, config, now)
  if (!settled.running) return settled
  return {
    ...settled,
    running: false,
    endsAt: null,
    remainingMs: remainingAt(settled, now),
    updatedAt: now,
  }
}

export function resumeState(state, config, now) {
  if (!isValidState(state)) throw new TypeError('Invalid Pomodoro state')
  assertFinite(now, 'now')
  if (state.running) return state
  const elapsed = Math.max(0, state.durationMs - state.remainingMs)
  const resumed = {
    ...state,
    running: true,
    startedAt: now - elapsed,
    endsAt: now + state.remainingMs,
    remainingMs: null,
    updatedAt: now,
  }
  return settleState(resumed, config, now)
}

export function skipState(state, config, now) {
  if (!isValidState(state)) throw new TypeError('Invalid Pomodoro state')
  return createRunningState(otherPhase(state.phase), config, now)
}

export function resetState(config, now) {
  return createRunningState(FOCUS, config, now)
}

export function formatRemaining(milliseconds) {
  assertFinite(milliseconds, 'milliseconds')
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
