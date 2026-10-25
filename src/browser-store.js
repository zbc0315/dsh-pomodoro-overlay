import {
  DEFAULT_CONFIG,
  FOCUS,
  createRunningState,
  formatRemaining,
  pauseState,
  parseConfig,
  remainingAt,
  resetState,
  resumeState,
  settleState,
  skipState,
  stateFromJSON,
} from './timer-core.js'

export const STATE_KEY = 'dsh-pomodoro-overlay:state:v1'

function defaultStorage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function defaultEventTarget() {
  return typeof window === 'undefined' ? null : window
}

function defaultDocument() {
  return typeof document === 'undefined' ? null : document
}

/**
 * Browser-local runtime state. Configuration arrives from DSH's native
 * ConfigForm after it is ready; this store never substitutes defaults while
 * that asynchronous read is still pending.
 */
export function createPomodoroStore(options = {}) {
  const now = options.now ?? (() => Date.now())
  const storage = options.storage === undefined ? defaultStorage() : options.storage
  const events = options.events === undefined ? defaultEventTarget() : options.events
  const documentRef = options.document === undefined ? defaultDocument() : options.document
  const timers = options.timers ?? events
  const tickMs = options.tickMs ?? 250

  const listeners = new Set()
  let config = parseConfig(options.initialConfig ?? DEFAULT_CONFIG)
  let state = createRunningState(FOCUS, config, now())
  let snapshot = null
  let started = false
  let disposed = false
  let intervalId = null
  let storageAvailable = Boolean(storage)

  function readState() {
    if (!storage) {
      storageAvailable = false
      return null
    }
    try {
      const value = storage.getItem(STATE_KEY)
      storageAvailable = true
      return stateFromJSON(value)
    } catch {
      storageAvailable = false
      return null
    }
  }

  function writeState() {
    if (!storage) {
      storageAvailable = false
      return false
    }
    try {
      storage.setItem(STATE_KEY, JSON.stringify(state))
      storageAvailable = true
      return true
    } catch {
      // A persistence failure must not stop the active timer or its next phase.
      storageAvailable = false
      return false
    }
  }

  function makeSnapshot(time) {
    const remainingMs = remainingAt(state, time)
    return Object.freeze({
      active: started && !disposed,
      phase: state.phase,
      running: state.running,
      text: formatRemaining(remainingMs),
      remainingMs,
      config,
      state,
      storageAvailable,
      updatedAt: state.updatedAt,
    })
  }

  function emit(time, force = false) {
    const next = makeSnapshot(time)
    const changed = force || !snapshot
      || next.active !== snapshot.active
      || next.phase !== snapshot.phase
      || next.running !== snapshot.running
      || next.text !== snapshot.text
      || next.config !== snapshot.config
      || next.updatedAt !== snapshot.updatedAt
      || next.storageAvailable !== snapshot.storageAvailable
    if (!changed) return
    snapshot = next
    for (const listener of [...listeners]) listener()
  }

  function refresh(force = false) {
    if (!started || disposed) return
    const time = now()
    const settled = settleState(state, config, time)
    if (settled !== state) {
      state = settled
      writeState()
    }
    emit(time, force)
  }

  function commit(next, time) {
    state = next
    writeState()
    emit(time, true)
  }

  function onStorage(event) {
    if (disposed || !started || event?.key !== STATE_KEY) return
    const incoming = stateFromJSON(event.newValue)
    if (!incoming || incoming.updatedAt < state.updatedAt) return
    const time = now()
    const settled = settleState(incoming, config, time)
    state = settled
    if (settled !== incoming) writeState()
    emit(time, true)
  }

  function onVisibility() {
    if (!documentRef?.hidden) refresh(true)
  }

  function onWake() {
    refresh(true)
  }

  function start() {
    if (started || disposed) return
    started = true

    const storedState = readState()
    state = storedState ?? createRunningState(FOCUS, config, now())
    if (!storedState) writeState()

    events?.addEventListener?.('storage', onStorage)
    events?.addEventListener?.('focus', onWake)
    events?.addEventListener?.('pageshow', onWake)
    documentRef?.addEventListener?.('visibilitychange', onVisibility)
    intervalId = timers?.setInterval?.(refresh, tickMs) ?? null
    refresh(true)
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('Listener must be a function')
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  function getSnapshot() {
    if (!snapshot) snapshot = makeSnapshot(now())
    return snapshot
  }

  /** Accept a newly ready or updated native DSH configuration. */
  function setConfig(value) {
    if (disposed) return
    const next = parseConfig(value)
    const time = now()
    if (started) {
      // First settle with the OLD durations. Otherwise an expired focus could
      // be rewritten as a break using the new break duration retroactively.
      const settled = settleState(state, config, time)
      if (settled !== state) {
        state = settled
        writeState()
      }
    }
    config = next
    // The actual current phase, total duration and deadline stay untouched.
    emit(time, true)
  }

  function pause() {
    if (!started || disposed) return
    const time = now()
    commit(pauseState(state, config, time), time)
  }

  function resume() {
    if (!started || disposed) return
    const time = now()
    const settled = settleState(state, config, time)
    commit(resumeState(settled, config, time), time)
  }

  function skip() {
    if (!started || disposed) return
    const time = now()
    const settled = settleState(state, config, time)
    commit(skipState(settled, config, time), time)
  }

  function reset() {
    if (!started || disposed) return
    const time = now()
    commit(resetState(config, time), time)
  }

  function dispose() {
    if (disposed) return
    disposed = true
    started = false
    if (intervalId !== null) timers?.clearInterval?.(intervalId)
    intervalId = null
    events?.removeEventListener?.('storage', onStorage)
    events?.removeEventListener?.('focus', onWake)
    events?.removeEventListener?.('pageshow', onWake)
    documentRef?.removeEventListener?.('visibilitychange', onVisibility)
    listeners.clear()
    snapshot = null
  }

  return {
    start,
    subscribe,
    getSnapshot,
    setConfig,
    pause,
    resume,
    skip,
    reset,
    refresh,
    dispose,
  }
}
