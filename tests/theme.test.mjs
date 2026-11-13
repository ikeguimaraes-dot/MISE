import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.transpileModule(fs.readFileSync('src/lib/theme.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText

function runtime(saved = null, blocked = false) {
  const root = { dataset: {}, style: {}, classList: { toggle(name, active) { this[name] = active } } }
  let stored = saved; let events = 0; let meta
  const context = { exports: {}, document: { documentElement: root, querySelector: () => ({ setAttribute: (_, value) => { meta = value } }) }, localStorage: { getItem: () => { if (blocked) throw new Error('blocked'); return stored }, setItem: (_, value) => { if (blocked) throw new Error('blocked'); stored = value } }, window: { dispatchEvent: () => { events++ } }, Event: class {} }
  vm.runInNewContext(source, context)
  return { context, root, stored: () => stored, events: () => events, meta: () => meta }
}

test('tema escolhido é aplicado antes da pintura e persiste após recarregar', () => {
  const app = runtime('light')
  vm.runInNewContext(app.context.exports.THEME_BOOTSTRAP, app.context)
  assert.equal(app.root.dataset.theme, 'light')
  assert.equal(app.root.style.colorScheme, 'light')
  assert.equal(app.root.classList.dark, false)
  app.context.exports.applyTheme('dark')
  assert.equal(app.stored(), 'dark')
  assert.equal(app.root.classList.dark, true)
  assert.equal(app.meta(), '#171716')
  assert.equal(app.events(), 1)
  const nextLoad = runtime(app.stored())
  vm.runInNewContext(nextLoad.context.exports.THEME_BOOTSTRAP, nextLoad.context)
  assert.equal(nextLoad.root.dataset.theme, 'dark')
})

test('armazenamento bloqueado ou preferência desconhecida não quebra a página nem a troca', () => {
  for (const [saved, blocked] of [['invalid', false], [null, true]]) {
    const app = runtime(saved, blocked)
    vm.runInNewContext(app.context.exports.THEME_BOOTSTRAP, app.context)
    assert.equal(app.root.dataset.theme, 'dark')
    app.context.exports.applyTheme('light')
    assert.equal(app.root.dataset.theme, 'light')
    assert.equal(app.root.style.colorScheme, 'light')
  }
})
