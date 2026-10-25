import z from '@deepseek-ai/schemastery'

export const name = '@tom2012/dsh-pomodoro-overlay'

/** Volatile fields are exposed through DSH's revision-fenced settings forms. */
export const Config = z.object({
  focusMinutes: z.number().step(1).min(1).max(240).default(25).volatile()
    .description('专注时长（分钟），从下一专注阶段生效'),
  breakMinutes: z.number().step(1).min(1).max(240).default(5).volatile()
    .description('休息时长（分钟），从下一休息阶段生效'),
  focusColor: z.string().pattern(/^#[0-9a-f]{6}$/i).default('#9ca3af').volatile()
    .description('专注倒计时颜色，保存后立即生效'),
  breakColor: z.string().pattern(/^#[0-9a-f]{6}$/i).default('#ef4444').volatile()
    .description('休息倒计时颜色，保存后立即生效'),
  focusOpacity: z.number().step(0.01).min(0).max(1).default(0.1).volatile()
    .description('专注倒计时数字不透明度，0–1'),
  breakOpacity: z.number().step(0.01).min(0).max(1).default(0.3).volatile()
    .description('休息倒计时数字不透明度，0–1'),
  fontFamily: z.string().pattern(/^[\p{L}\p{N}][\p{L}\p{N} _.-]{0,79}$/u).default('等线').volatile()
    .description('专注与休息共用的时钟字体，默认等线（DengXian）'),
})

export function apply(ctx) {
  // The plugin provides its own settings UI; disable any generated placeholder.
  ctx.inject(['settings'], (child) => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber))
  })
}
