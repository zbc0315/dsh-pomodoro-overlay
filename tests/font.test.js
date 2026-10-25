import test from 'node:test'
import assert from 'node:assert/strict'

import { FONT_OPTIONS, fontStack } from '../src/font.js'

test('default font is DengXian with a local Chinese-name fallback', () => {
  assert.equal(FONT_OPTIONS[0].value, '等线')
  assert.equal(fontStack('等线'), '"DengXian", "等线", sans-serif')
  assert(fontStack('monospace').includes('ui-monospace'))
  assert(fontStack('system-ui').includes('system-ui'))
})

test('custom font names use local stacks without remote font loading', () => {
  for (const option of FONT_OPTIONS) {
    assert.equal(fontStack(option.value), option.stack)
    assert(!option.stack.includes('http'))
  }
  assert.equal(fontStack('Noto Sans CJK SC'), '"Noto Sans CJK SC", sans-serif')
  assert.equal(fontStack(''), 'sans-serif')
  assert(fontStack('A"B').includes('\\"'))
})
