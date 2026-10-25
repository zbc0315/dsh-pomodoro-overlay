import React from 'react'

import { FONT_OPTIONS, fontStack } from './font.js'
import {
  DEFAULT_CONFIG,
  FOCUS,
  isValidColor,
  isValidFontFamily,
  isValidMinutes,
  parseConfig,
} from './timer-core.js'

const h = React.createElement
const MINUTES_FIELDS = ['focusMinutes', 'breakMinutes']
const COLOR_FIELDS = ['focusColor', 'breakColor']
const OPACITY_FIELDS = ['focusOpacity', 'breakOpacity']

function phaseName(phase) {
  return phase === FOCUS ? '专注' : '休息'
}

function draftFromConfig(value = DEFAULT_CONFIG) {
  const source = { ...DEFAULT_CONFIG, ...value }
  return {
    focusMinutes: String(source.focusMinutes),
    breakMinutes: String(source.breakMinutes),
    focusColor: source.focusColor,
    breakColor: source.breakColor,
    focusOpacity: String(Math.round(source.focusOpacity * 100)),
    breakOpacity: String(Math.round(source.breakOpacity * 100)),
    fontFamily: source.fontFamily,
  }
}

function isValidPercent(value) {
  if (typeof value === 'string' && value.trim() === '') return false
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 100
}

function configFromDraft(draft) {
  if (!MINUTES_FIELDS.every((field) => isValidMinutes(draft[field]))) {
    throw new RangeError('工作和休息时长均需为 1–240 之间的整数分钟。')
  }
  if (!COLOR_FIELDS.every((field) => isValidColor(draft[field]))) {
    throw new TypeError('颜色需使用 #RRGGBB 格式。')
  }
  if (!OPACITY_FIELDS.every((field) => isValidPercent(draft[field]))) {
    throw new RangeError('数字不透明度需为 0–100 的整数百分比。')
  }
  if (!isValidFontFamily(draft.fontFamily.trim())) {
    throw new TypeError('请输入一个本机字体名称（1–80 个字符，不包含引号或逗号）。')
  }
  return parseConfig({
    focusMinutes: Number(draft.focusMinutes),
    breakMinutes: Number(draft.breakMinutes),
    focusColor: draft.focusColor,
    breakColor: draft.breakColor,
    focusOpacity: Number(draft.focusOpacity) / 100,
    breakOpacity: Number(draft.breakOpacity) / 100,
    fontFamily: draft.fontFamily.trim(),
  })
}

function useFormSnapshot(form) {
  const subscribe = React.useCallback((listener) => form.subscribe(listener), [form])
  const getSnapshot = React.useCallback(() => form.getSnapshot(), [form])
  return React.useSyncExternalStore(subscribe, getSnapshot)
}

export function PomodoroSettings({ form, store }) {
  const formSnapshot = useFormSnapshot(form)
  const timerSnapshot = useFormSnapshot(store)
  const [draft, setDraft] = React.useState(() => draftFromConfig(form.getSnapshot().value))
  const [baseRevision, setBaseRevision] = React.useState(form.getSnapshot().revision)
  const [dirty, setDirty] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')
  const alive = React.useRef(true)

  React.useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  const loadLatest = React.useCallback((clearFeedback = true) => {
    const latest = form.getSnapshot()
    if (latest.status === 'ready' && latest.value) {
      setDraft(draftFromConfig(latest.value))
      setBaseRevision(latest.revision)
      setDirty(false)
      if (clearFeedback) {
        setError('')
        setNotice('')
      }
    }
  }, [form])

  React.useEffect(() => {
    if (!dirty && formSnapshot.status === 'ready' && formSnapshot.value) loadLatest(false)
  }, [formSnapshot, dirty, loadLatest])

  function change(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
    setDirty(true)
    setError('')
    setNotice('')
  }

  async function save(event) {
    event.preventDefault()
    if (saving || !dirty || !formSnapshot.writable) return
    let next
    try {
      next = configFromDraft(draft)
    } catch (validationError) {
      setError(validationError.message)
      setNotice('')
      return
    }
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const accepted = await form.mutate([
        { op: 'set', path: ['focusMinutes'], value: next.focusMinutes },
        { op: 'set', path: ['breakMinutes'], value: next.breakMinutes },
        { op: 'set', path: ['focusColor'], value: next.focusColor },
        { op: 'set', path: ['breakColor'], value: next.breakColor },
        { op: 'set', path: ['focusOpacity'], value: next.focusOpacity },
        { op: 'set', path: ['breakOpacity'], value: next.breakOpacity },
        { op: 'set', path: ['fontFamily'], value: next.fontFamily },
      ], baseRevision)
      if (!alive.current) return
      if (accepted) {
        setDirty(false)
        setNotice('已保存。字体、颜色和不透明度已应用；新时长从下一阶段生效。')
      } else {
        setError('设置已在其他页面变化，本次未覆盖。草稿已保留，请核对最新值后重试。')
      }
    } catch {
      if (alive.current) setError('保存失败，请检查连接后重试。草稿已保留。')
    } finally {
      if (alive.current) setSaving(false)
    }
  }

  const ready = formSnapshot.status === 'ready' && Boolean(formSnapshot.value)
  const disabled = !ready || !formSnapshot.writable || saving

  function field(name, title, description, control) {
    return h('div', { className: 'dpo-field', key: name }, [
      h('div', { className: 'dpo-field-copy', key: 'copy' }, [
        h('label', { htmlFor: `dpo-settings-${name}`, key: 'label' }, title),
        h('span', { className: 'dpo-hint', id: `dpo-settings-${name}-hint`, key: 'hint' }, description),
      ]),
      control,
    ])
  }

  function phaseCard(phase) {
    const minutes = `${phase}Minutes`
    const color = `${phase}Color`
    const opacity = `${phase}Opacity`
    const label = phaseName(phase)
    const previewOpacity = isValidPercent(draft[opacity]) ? Number(draft[opacity]) / 100 : 0
    return h('fieldset', {
      className: 'dpo-phase-card',
      'data-dpo-phase-settings': phase,
      key: phase,
      disabled,
    }, [
      h('legend', { key: 'legend' }, label),
      h('p', { className: 'dpo-hint', key: 'phase-hint' },
        phase === FOCUS ? '工作阶段的周期与大数字外观' : '休息阶段的周期与大数字外观'),
      field(minutes, `${label}时长`, '1–240 分钟', h('input', {
        key: 'input',
        id: `dpo-settings-${minutes}`,
        className: 'dpo-input',
        'data-dpo-setting': minutes,
        type: 'number',
        min: 1,
        max: 240,
        step: 1,
        inputMode: 'numeric',
        value: draft[minutes],
        onChange: (event) => change(minutes, event.currentTarget.value),
        'aria-describedby': `dpo-settings-${minutes}-hint`,
      })),
      field(color, '数字颜色', '六位十六进制颜色', h('div', { className: 'dpo-color-control', key: 'input' }, [
        h('input', {
          key: 'color',
          id: `dpo-settings-${color}`,
          className: 'dpo-color-input',
          'data-dpo-setting': color,
          type: 'color',
          value: draft[color],
          onChange: (event) => change(color, event.currentTarget.value),
          'aria-describedby': `dpo-settings-${color}-hint`,
        }),
        h('code', { key: 'value', className: 'dpo-color-value' }, draft[color].toUpperCase()),
      ])),
      field(opacity, '数字不透明度', '0% 完全透明，100% 不透明', h('div', { className: 'dpo-range-control', key: 'input' }, [
        h('input', {
          key: 'range',
          id: `dpo-settings-${opacity}`,
          className: 'dpo-range',
          'data-dpo-setting': opacity,
          type: 'range',
          min: 0,
          max: 100,
          step: 1,
          value: draft[opacity],
          onChange: (event) => change(opacity, event.currentTarget.value),
          'aria-valuetext': `${draft[opacity]}%`,
          'aria-describedby': `dpo-settings-${opacity}-hint`,
        }),
        h('output', {
          key: 'output',
          className: 'dpo-output',
          htmlFor: `dpo-settings-${opacity}`,
          'data-dpo-opacity-value': phase,
        }, `${draft[opacity]}%`),
      ])),
      h('div', {
        className: 'dpo-preview',
        'data-dpo-preview': phase,
        key: 'preview',
        style: {
          '--dpo-preview-color': draft[color],
          '--dpo-preview-opacity': previewOpacity,
          '--dpo-preview-font': fontStack(draft.fontFamily),
        },
      }, [
        h('span', { className: 'dpo-hint', key: 'label' }, '草稿预览'),
        h('span', { className: 'dpo-preview-number', 'aria-hidden': 'true', key: 'number' },
          phase === FOCUS ? '25:00' : '05:00'),
      ]),
    ])
  }

  function fontCard() {
    return h('fieldset', {
      className: 'dpo-phase-card',
      'data-dpo-font-settings': '',
      key: 'font',
      disabled,
    }, [
      h('legend', { key: 'legend' }, '时钟字体'),
      h('p', { className: 'dpo-hint', key: 'font-hint' }, '专注与休息共用；只使用本机字体，不发起字体下载。'),
      field('fontFamily', '字体名称', '默认等线（DengXian），可输入其他本机字体', h('div', {
        className: 'dpo-font-control',
        key: 'input',
      }, [
        h('input', {
          key: 'font',
          id: 'dpo-settings-fontFamily',
          className: 'dpo-input',
          'data-dpo-setting': 'fontFamily',
          type: 'text',
          list: 'dpo-font-options',
          maxLength: 80,
          autoComplete: 'off',
          autoCapitalize: 'off',
          spellCheck: false,
          value: draft.fontFamily,
          onChange: (event) => change('fontFamily', event.currentTarget.value),
          'aria-describedby': 'dpo-settings-fontFamily-hint',
        }),
        h('datalist', { id: 'dpo-font-options', key: 'options' }, FONT_OPTIONS.map((option) => h('option', {
          key: option.value,
          value: option.value,
          label: option.label,
        }))),
      ])),
    ])
  }

  return h('section', { className: 'dpo-settings', 'data-dpo-settings': '' }, [
    h('h2', { key: 'title' }, '番茄钟'),
    h('p', { className: 'dpo-description', key: 'description' },
      '自动进行「专注 → 休息」循环。倒计时仅覆盖聊天消息区域；此处预览草稿，保存后应用。'),
    formSnapshot.status === 'loading'
      ? h('p', { key: 'loading', role: 'status' }, '正在读取番茄钟设置…')
      : null,
    formSnapshot.status === 'unavailable'
      ? h('p', { key: 'unavailable', className: 'dpo-error', role: 'alert' },
        '当前客户端无法读取番茄钟配置。')
      : null,
    ready ? h('form', { key: 'form', className: 'dpo-form', noValidate: true, onSubmit: save }, [
      fontCard(),
      phaseCard(FOCUS),
      phaseCard('break'),
      h('p', { className: 'dpo-hint', key: 'rule' },
        '保存不打断当前计时。字体、颜色和不透明度立即生效；新时长从下一阶段开始生效。'),
      h('div', { className: 'dpo-actions', key: 'actions' }, [
        h('button', {
          key: 'save',
          type: 'submit',
          className: 'dpo-button dpo-primary',
          'data-dpo-save': '',
          disabled: disabled || !dirty,
        }, saving ? '保存中…' : '保存设置'),
        h('button', {
          key: 'discard',
          type: 'button',
          className: 'dpo-button',
          'data-dpo-discard': '',
          disabled: saving || !dirty,
          onClick: () => loadLatest(),
        }, '放弃修改'),
      ]),
    ]) : null,
    !formSnapshot.writable && ready
      ? h('p', { key: 'readonly', className: 'dpo-warning' }, '当前配置为只读。')
      : null,
    error ? h('p', { key: 'error', className: 'dpo-error', role: 'alert' }, error) : null,
    notice ? h('p', { key: 'notice', className: 'dpo-success', role: 'status' }, notice) : null,
    !timerSnapshot.storageAvailable
      ? h('p', { key: 'storage', className: 'dpo-warning', role: 'status' },
        '浏览器存储不可用：计时仍在运行，但刷新后可能重新开始。')
      : null,
    timerSnapshot.active ? h('div', { className: 'dpo-current', key: 'current' }, [
      h('span', { key: 'phase' }, `当前阶段：${phaseName(timerSnapshot.phase)}${timerSnapshot.running ? '' : '（已暂停）'}`),
      h('span', { key: 'time' }, `剩余：${timerSnapshot.text}`),
    ]) : null,
  ])
}
