export const FONT_OPTIONS = Object.freeze([
  { value: '等线', label: 'DengXian（默认）', stack: '"DengXian", "等线", sans-serif' },
  { value: 'system-ui', label: '系统无衬线', stack: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { value: 'monospace', label: '等宽字体', stack: 'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace' },
  { value: 'Arial', label: 'Arial', stack: 'Arial, Helvetica, sans-serif' },
  { value: 'Courier New', label: 'Courier New', stack: '"Courier New", Courier, monospace' },
  { value: 'Georgia', label: 'Georgia', stack: 'Georgia, "Times New Roman", serif' },
])

/** Resolve a single installed font name to a safe local-only CSS font stack. */
export function fontStack(family) {
  if (typeof family !== 'string' || family.trim() === '') return 'sans-serif'
  const normalized = family.trim()
  const known = FONT_OPTIONS.find((option) => option.value === normalized)
  if (known) return known.stack
  const escaped = normalized.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `"${escaped}", sans-serif`
}
