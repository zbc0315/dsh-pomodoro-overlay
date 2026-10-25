import React from 'react'

import { createPomodoroStore } from './browser-store.js'
import { findChatOverlay } from './chat-geometry.js'
import { fontStack } from './font.js'
import { CSS } from './styles.js'
import { PomodoroSettings } from './settings.js'
import { FOCUS } from './timer-core.js'

const h = React.createElement
const PACKAGE_NAME = 'dsh-pomodoro-overlay'
const FORM_ID = 'pomodoro-overlay'

function phaseName(phase) {
  return phase === FOCUS ? '专注' : '休息'
}

function fitCountdown(root, number) {
  if (!root || !number) return
  if (root.hidden || root.clientWidth === 0 || root.clientHeight === 0) {
    root.__dpoFitKey = ''
    return
  }
  const computed = getComputedStyle(number)
  const text = number.textContent || '00:00'
  const key = [root.clientWidth, root.clientHeight, text, computed.fontFamily, computed.fontWeight].join('|')
  if (root.__dpoFitKey === key) return
  root.__dpoFitKey = key

  const availableWidth = Math.max(32, root.clientWidth - 32)
  const availableHeight = Math.max(32, root.clientHeight - 64)
  let widthAt100 = availableWidth / 3
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (context) {
    context.font = `${computed.fontWeight} 100px ${computed.fontFamily}`
    // The display face uses -0.065em tracking; include it in the fit estimate.
    widthAt100 = Math.max(1, context.measureText(text).width - (text.length - 1) * 6.5)
  }
  const size = Math.max(24, Math.floor(Math.min(
    availableHeight,
    availableWidth * 100 / widthAt100,
  )))
  number.style.fontSize = `${size}px`
}

function ActiveOverlay({ snapshot }) {
  const rootRef = React.useRef(null)
  const numberRef = React.useRef(null)

  React.useLayoutEffect(() => {
    fitCountdown(rootRef.current, numberRef.current)
  }, [snapshot.text, snapshot.config.fontFamily])

  React.useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined
    let disposed = false
    let frame = null
    let mutationTimer = null
    let observedChat = null
    let observedComposer = null

    const geometryObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => scheduleFrame())
      : null
    const numberObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => fitCountdown(root, numberRef.current))
      : null

    function update() {
      if (disposed) return
      const match = findChatOverlay(document)
      const nextChat = match?.chat ?? null
      const nextComposer = nextChat?.querySelector('[data-composer-seat]') ?? null
      if (nextChat !== observedChat || nextComposer !== observedComposer) {
        observedChat = nextChat
        observedComposer = nextComposer
        geometryObserver?.disconnect()
        if (observedChat) geometryObserver?.observe(observedChat)
        if (observedComposer) geometryObserver?.observe(observedComposer)
      }

      if (!match) {
        root.hidden = true
        root.dataset.dpoGeometry = 'hidden'
        return
      }
      const { rect } = match
      root.style.left = `${rect.left}px`
      root.style.top = `${rect.top}px`
      root.style.width = `${rect.width}px`
      root.style.height = `${rect.height}px`
      root.hidden = false
      root.dataset.dpoGeometry = 'active'
      fitCountdown(root, numberRef.current)
    }

    function scheduleFrame() {
      if (disposed || frame !== null) return
      frame = requestAnimationFrame(() => {
        frame = null
        update()
      })
    }

    function scheduleMutationCheck() {
      if (disposed || mutationTimer !== null) return
      // Streaming messages can mutate often; rebind at most once per 160ms.
      mutationTimer = window.setTimeout(() => {
        mutationTimer = null
        update()
      }, 160)
    }

    const mutationObserver = typeof MutationObserver === 'function'
      ? new MutationObserver(scheduleMutationCheck)
      : null
    mutationObserver?.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-conversation-content', 'data-chat-flow', 'data-composer-seat', 'hidden', 'inert'],
    })
    numberObserver?.observe(root)
    window.addEventListener('resize', scheduleFrame)
    window.addEventListener('scroll', scheduleFrame, true)
    update()

    return () => {
      disposed = true
      geometryObserver?.disconnect()
      numberObserver?.disconnect()
      mutationObserver?.disconnect()
      if (frame !== null) cancelAnimationFrame(frame)
      if (mutationTimer !== null) clearTimeout(mutationTimer)
      window.removeEventListener('resize', scheduleFrame)
      window.removeEventListener('scroll', scheduleFrame, true)
    }
  }, [])

  const label = phaseName(snapshot.phase)
  const status = snapshot.running ? label : `${label} · 已暂停`
  const appearance = snapshot.phase === FOCUS
    ? { color: snapshot.config.focusColor, opacity: snapshot.config.focusOpacity }
    : { color: snapshot.config.breakColor, opacity: snapshot.config.breakOpacity }

  return h('div', {
    ref: rootRef,
    className: 'dpo-overlay',
    hidden: true,
    role: 'group',
    'aria-label': `番茄钟，${status}`,
    'data-dpo-overlay': '',
    'data-phase': snapshot.phase,
    'data-running': String(snapshot.running),
    'data-dpo-geometry': 'hidden',
  }, [
    h('div', {
      key: 'phase',
      className: 'dpo-phase',
      'data-dpo-phase': snapshot.phase,
      title: snapshot.storageAvailable
        ? '刷新或重开页面后按原时间线恢复'
        : '浏览器存储不可用：本次页面内继续计时，刷新后可能重置',
    }, status),
    h('div', {
      key: 'number',
      ref: numberRef,
      className: 'dpo-number',
      'data-dpo-number': '',
      'data-dpo-color': appearance.color,
      'data-dpo-opacity': String(appearance.opacity),
      'data-dpo-font-family': snapshot.config.fontFamily,
      'aria-hidden': 'true',
      style: {
        color: appearance.color,
        opacity: appearance.opacity,
        fontFamily: fontStack(snapshot.config.fontFamily),
      },
    }, snapshot.text),
    h('span', {
      key: 'accessible-time',
      className: 'dpo-sr-only',
      role: 'timer',
      'aria-label': `${status}，剩余 ${snapshot.text}`,
    }, `${status}，剩余 ${snapshot.text}`),
  ])
}

function PomodoroOverlay({ store }) {
  const subscribe = React.useCallback((listener) => store.subscribe(listener), [store])
  const getSnapshot = React.useCallback(() => store.getSnapshot(), [store])
  const snapshot = React.useSyncExternalStore(subscribe, getSnapshot)
  if (!snapshot.active) return null
  return h(ActiveOverlay, { snapshot })
}

export const name = PACKAGE_NAME
export const inject = ['slots', 'configForms']

export function apply(ctx) {
  const form = ctx.configForms.get(FORM_ID)
  const store = createPomodoroStore()

  ctx.effect(() => {
    const syncConfig = () => {
      const snapshot = form.getSnapshot()
      if (snapshot.status !== 'ready' || !snapshot.value) return
      try {
        store.setConfig(snapshot.value)
        store.start()
      } catch (error) {
        ctx.logger?.error?.('Pomodoro Overlay could not accept its configuration', error)
      }
    }
    const unsubscribe = form.subscribe(syncConfig)
    syncConfig()
    return () => {
      unsubscribe()
      store.dispose()
    }
  }, 'pomodoro-overlay: native configuration and timer')

  ctx.effect(() => {
    const style = document.createElement('style')
    style.setAttribute('data-dpo-style', '')
    style.setAttribute('data-plugin', PACKAGE_NAME)
    style.textContent = CSS
    document.head.appendChild(style)
    return () => style.remove()
  }, 'pomodoro-overlay: styles')

  ctx.slots.inject('shell.overlay', () => ctx.slots.register(
    { name: 'shell.overlay', id: PACKAGE_NAME, order: -100, label: '番茄钟' },
    () => h(PomodoroOverlay, { store }),
  ))

  ctx.slots.inject('settings.section', () => ctx.slots.register(
    { name: 'settings.section', id: 'pomodoro', order: 30, label: '番茄钟' },
    () => h(PomodoroSettings, { form, store }),
  ))
}
