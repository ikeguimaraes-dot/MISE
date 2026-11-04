import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
const require = createRequire(import.meta.url)
function load(file, mocks = {}) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  vm.runInNewContext(code, { exports, require: name => Object.hasOwn(mocks, name) ? mocks[name] : require(name) })
  return exports
}
const item = { id: 'request', status: 'recusado', mise_managed: true, mise_requested_by: 'owner', mise_named_at: null, quantidade: 2, valor_unitario: 150, valor_total: 300, data_trabalho: '2026-11-04', periodo: 'jantar', motivo: 'folga', motivo_detalhe: 'Detalhe original', funcao: 'Garçom', setor: 'Salão', solicitante_nome: 'Solicitante original', preenchidos: 0 }
function render(action, role) {
  let state = 0
  const overrides = { 2: { item, people: [], events: [] }, 3: item.id, 6: false, 10: action, 11: [{ id: 'job', nome: 'Garçom', setor_padrao: 'Salão' }], 14: 'job', 15: 2, 16: '150', 17: item.data_trabalho }
  const { ExtraPositions } = load('src/components/extras-real/extras-positions.tsx', {
    react: { ...React, useState: initial => { state++; return [Object.hasOwn(overrides, state) ? overrides[state] : typeof initial === 'function' ? initial() : initial, () => {}] }, useEffect: () => {}, useRef: () => ({ current: null }) },
    './use-detail-navigation': { useDetailNavigation: () => ({ detailRef: { current: null }, listRef: { current: null }, returnToList() {} }) },
    './currency-input': { ExtraCurrencyInput: ({ value, label }) => React.createElement('input', { value, 'aria-label': label, readOnly: true }) },
    '@/lib/extras/catalog': load('src/lib/extras/catalog.ts'),
    '@/lib/extras/positions': load('src/lib/extras/positions.ts'),
    '@/lib/extras/workflow': load('src/lib/extras/workflow.ts'),
    '@/lib/extras/alcada': { weekDays: () => ['2026-11-02', '2026-11-08'] },
    '@/components/extras-evaluation/weekly-budget': { useWeeklyBudget: () => ({ budget: null }) },
  })
  return renderToStaticMarkup(React.createElement(ExtraPositions, { unit: { id: 'unit', name: 'Casa' }, day: '2026-11-04', role, employeeId: 'owner', queue: true, creating: false, onClose() {}, onChanged() {}, onPerson() {} }))
}

test('correção traz dados anteriores, mantém solicitante e exige justificativa sem novo cadastro', () => {
  const html = render('reenviar_recusada', 'lider')
  for (const value of ['Corrigir pedido recusado', 'Solicitante original', 'Detalhe original', 'Justificativa da correção', 'Reenviar para o diretor']) assert.ok(html.includes(value), value)
  assert.ok(html.includes('selected="">Jantar</option>'))
  assert.ok(html.includes('selected="">Folga</option>'))
  assert.ok(!html.includes('Registrar solicitação'))
  assert.ok(!html.includes('Nenhum solicitante ativo'))
})

test('diretor vê confirmação da reconsideração com justificativa obrigatória', () => {
  const html = render('reconsiderar_recusa', 'diretor')
  assert.ok(html.includes('única reconsideração disponível'))
  assert.ok(html.includes('voltará a consumir a alçada'))
  assert.match(html, /<textarea[^>]*name="note"[^>]*required/)
})
