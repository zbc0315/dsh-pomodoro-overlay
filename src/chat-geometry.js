/** Current browser viewport rectangle used for the global clock overlay. */
export function viewportRect(windowRef) {
  const doc = windowRef?.document
  const docEl = doc?.documentElement
  const width = windowRef?.innerWidth ?? docEl?.clientWidth
  const height = windowRef?.innerHeight ?? docEl?.clientHeight
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null
  if (width <= 0 || height <= 0) return null
  return { left: 0, top: 0, right: width, bottom: height, width, height }
}
