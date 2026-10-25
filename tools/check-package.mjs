import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const patch = await readFile(join(root, 'cordis.patch.yml'), 'utf8')
const host = await readFile(join(root, 'lib', 'index.js'), 'utf8')
const client = await readFile(join(root, 'client', 'client.js'), 'utf8')

assert.equal(manifest.name, 'dsh-pomodoro-overlay')
assert.equal(manifest.type, 'module')
assert.equal(manifest.exports['.'], './lib/index.js')
assert.equal(manifest.exports['./client'], './client/client.js')
assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml')
assert.equal(manifest.dsh.client.platform, 'web')
assert.equal(manifest.dsh.client.immediately, true)
for (const dependency of [
  '@deepseek-ai/dsh-client-ui-layout',
  '@deepseek-ai/dsh-client-ui-settings',
]) assert(manifest.dsh.client.inject.includes(dependency), `missing client inject: ${dependency}`)
assert(manifest.dependencies['@deepseek-ai/schemastery'])
assert(!manifest.dependencies.react, 'React must remain host-provided')
assert(patch.includes('id: pomodoro-overlay'))
assert(patch.includes("name: 'dsh-pomodoro-overlay'"))
for (const field of ['focusMinutes', 'breakMinutes', 'focusColor', 'breakColor', 'focusOpacity', 'breakOpacity', 'fontFamily']) {
  assert(host.includes(field), `missing host config: ${field}`)
}
assert(host.match(/\.volatile\(\)/g)?.length === 7)
assert(client.includes('window.__ModuleLoader__.load'))
assert(client.includes('dsh-pomodoro-overlay'))
assert(client.includes('shell.overlay'))
assert(client.includes('settings.section'))
assert(!client.includes('plugins.bundle.config'), 'settings must not remain in plugin details')
for (const field of ['focusMinutes', 'breakMinutes', 'focusColor', 'breakColor', 'focusOpacity', 'breakOpacity', 'fontFamily']) {
  assert(client.includes(field), `missing client setting: ${field}`)
}
assert(client.includes('data-dpo-preview'))
assert(client.includes('data-dpo-font-settings'))
assert(client.includes('DengXian'))
assert(client.includes('data-dpo-overlay'))
assert(!client.includes('data-dpo-action'), 'chat overlay controls must stay removed')
assert(!client.includes('dpo-toolbar'), 'chat overlay toolbar must stay removed')
assert(!client.includes('番茄钟控制'), 'chat overlay control group must stay removed')
assert(!client.includes('require("react-dom")'))

console.log('Package manifest, host config and client bundle checks passed')
