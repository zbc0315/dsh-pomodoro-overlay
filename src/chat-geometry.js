export const CHAT_SELECTOR = '[data-conversation-content][data-conversation-region="chat"]'
export const COMPOSER_SELECTOR = '[data-composer-seat]'
export const CHAT_FLOW_SELECTOR = '[data-chat-flow]'

function finiteRect(rect) {
  return rect && ['left', 'top', 'right', 'bottom', 'width', 'height'].every((key) => Number.isFinite(rect[key]))
}

/**
 * Resolve the visible message-only rectangle. This reads current DSH semantic
 * DOM markers but never mutates them. Any mismatch fails closed.
 */
export function chatOverlayRect(chat) {
  if (!chat || chat.isConnected === false || chat.closest?.('[hidden], [inert]')) return null
  if (!chat.querySelector?.(CHAT_FLOW_SELECTOR)) return null
  const body = chat.getBoundingClientRect?.()
  if (!finiteRect(body) || body.width <= 0 || body.height <= 0) return null

  const composer = chat.querySelector?.(COMPOSER_SELECTOR)
  const composerRect = composer?.getBoundingClientRect?.()
  const bottom = finiteRect(composerRect)
    ? Math.min(body.bottom, composerRect.top)
    : body.bottom
  const height = bottom - body.top
  if (body.width < 160 || height < 120) return null

  return {
    left: body.left,
    top: body.top,
    right: body.right,
    bottom,
    width: body.width,
    height,
  }
}

/** Prefer the largest visible Conversation when embedded chats also exist. */
export function findChatOverlay(documentRef) {
  if (!documentRef?.querySelectorAll) return null
  let best = null
  for (const chat of documentRef.querySelectorAll(CHAT_SELECTOR)) {
    const rect = chatOverlayRect(chat)
    if (!rect) continue
    if (!best || rect.width * rect.height > best.rect.width * best.rect.height) {
      best = { chat, rect }
    }
  }
  return best
}
