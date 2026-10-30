import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function load(path, imports = {}) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  vm.runInNewContext(code, { exports, require: name => imports[name] || require(name) })
  return exports
}
const model = load('src/components/eventos/model.ts')
const EventPrint = load('src/components/eventos/event-print.tsx', { './model': model }).default
const render = (event, documents = []) => renderToStaticMarkup(createElement(EventPrint, { event, documents }))

test('impressão preserva dados operacionais e exclui todo o financeiro', () => {
  const html = render({ id: 42, nome_evento: 'Recepção de verão', casa: 'MEET & EAT', espacos: 'Rooftop\nBar Secreto', status: 'confirmado', versao: 3, data_inicio: '2026-11-01', hora_inicio: '18:00:00', num_convidados: 0, custo_evento: 1000, valor_cobrado: 500, extras_observacoes: 'SEGREDO FINANCEIRO', comprovantes_pagamento: '[{"name":"comprovante-sigiloso.pdf"}]', briefing_cliente: 'Briefing completo', campo_livre: 'Alerta operacional', menores: 'Não permitido' })
  for (const value of ['RECEPÇÃO DE VERÃO', '#42', 'V3', '01/11/2026', '18:00', 'Rooftop / Bar Secreto', 'Briefing completo', 'Alerta operacional', 'Não permitido', '<dd>0</dd>']) assert.ok(html.includes(value), value)
  for (const value of ['SEGREDO FINANCEIRO', 'comprovante-sigiloso.pdf', 'Valores do evento', 'Comprovantes de pagamento', 'R$']) assert.ok(!html.includes(value), value)
})

test('menus preservam descrições extensas, observações e informações gerais', () => {
  const description = 'Linha completa do menu\n'.repeat(100) + 'ÚLTIMA LINHA'
  const html = render({ nome_evento: 'Teste', menu_bar: [{ categoria: 'Bebidas', servico: 'Open bar', hr_ini: '18:00', hr_fim: '23:00', descritivo: description, obs: 'Sem vidro' }, { servico: '_info', descritivo: 'Informação geral importante' }] })
  for (const value of ['Menu bar', 'Open bar', '18:00 – 23:00', 'ÚLTIMA LINHA', 'Sem vidro', 'Informação geral importante', '<thead>']) assert.ok(html.includes(value), value)
  assert.equal((html.match(/Linha completa do menu/g) || []).length, 100)
})

test('brigada agrupa três pares e preserva todos os itens, inclusive última linha incompleta', () => {
  const html = render({ brigada: Array.from({ length: 7 }, (_, index) => ({ funcao: `Cargo ${index + 1}`, qtd: index + 1 })) })
  assert.equal((html.match(/<tbody><tr>|<\/tr><tr>/g) || []).length, 3)
  for (let i = 1; i <= 7; i++) assert.ok(html.includes(`Cargo ${i}`))
})

test('seções sem conteúdo não ocupam papel e documentos mantêm seus nomes', () => {
  const html = render({ nome_evento: 'Evento simples', layout_anexos: '[{"name":"Mapa do salão.pdf"}]' }, [{ key: 'contract', name: 'Contrato assinado.pdf' }])
  for (const value of ['Infraestrutura', 'Montagem e operação', 'Brigada', 'Menu bar', 'Menu cozinha']) assert.ok(!html.includes(value), value)
  for (const value of ['Mapa do salão.pdf', 'Contrato assinado.pdf']) assert.ok(html.includes(value), value)
})
