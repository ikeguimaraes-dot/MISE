import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function load(source, imports = {}) {
  const exports = {}
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  vm.runInNewContext(code, { exports, require: name => Object.hasOwn(imports, name) ? imports[name] : require(name) })
  return exports
}
const model = load(fs.readFileSync('src/components/eventos/model.ts', 'utf8'))
const { EventForm } = load(fs.readFileSync('src/components/eventos/eventos-client.tsx', 'utf8').replace('function EventForm(', 'export function EventForm('), {
  './model': model, './eventos.css': {}, './client-api': {}, 'next/navigation': {},
  './event-document': { default: () => null }, './event-print': { default: () => null },
})
const render = (event, readOnly = false) => renderToStaticMarkup(createElement(EventForm, { event, readOnly, onSave: async () => event, onFinancialSave: async () => event }))
const selects = html => [...html.matchAll(/<select\b[^>]*>([\s\S]*?)<\/select>/g)].map(match => match[1])

test('formulário oferece categorias e serviços de bar/cozinha em seletores, além da infraestrutura', () => {
  const html = render({ brigada: [{}], menu_bar: [{}], menu_cozinha: [{}] })
  const options = selects(html)
  for (const expected of [
    ['Maître', 'Chefe de Fila', 'Garçom', 'Cumin', 'Limpeza', 'Chefe de Bar', 'Bartender', 'Barback', 'Chef de Cozinha', 'Segurança', 'Bombeiro', 'Hostess'],
    ['Menu Aberto', 'Menu Fechado', 'Open Bar'],
    ['Não Alcoólicas', 'Alcoólicas', 'Vinhos e Champanhes', 'Pausa de Serviço', 'Encerramento de Serviço'],
    ['Coquetel Volante', 'Empratado', 'Cardápio Aberto'],
    ['Entradas', 'Saladas', 'Principais', 'Sobremesas', 'Pausa de Serviço', 'Encerramento de Serviço'],
    ['Casa', 'Locação'], ['Autorizado', 'Em Aprovação', 'Não Autorizado'],
    ['Contratado pelo Cliente', 'Contratado pela Casa', 'Não Contratado'],
    ['Pelo Cliente', 'Pela Casa', 'Não Contratado', 'Não se aplica'],
    ['Contratado', 'Não Contratado', 'UTI', 'Remoção'],
  ]) assert.ok(options.some(select => expected.every(option => select.includes(`>${option}</option>`))), expected.join(', '))
  assert.ok(html.includes('<textarea'))
  assert.ok(html.includes('type="time"'))
})

test('OS antiga mantém opções personalizadas, acentos legados e informações gerais', () => {
  const event = { brigada: [{ funcao: 'Garçon', qtd: 2 }, { funcao: 'Coordenador de eventos', qtd: 1 }], mobiliario: 'Mobiliário do fornecedor', gerador: 'Contrado Casa', menu_bar: [{ categoria: 'Categoria antiga', servico: 'Não Alcóolicas', descritivo: 'Descrição preservada', obs: 'Observação preservada' }, { servico: '_info', descritivo: 'Informação geral preservada' }], menu_cozinha: [{ categoria: 'Buffet especial', servico: 'Serviço antigo' }] }
  const html = render(event)
  for (const value of ['Garçon', 'Coordenador de eventos', 'Mobiliário do fornecedor', 'Contrado Casa', 'Categoria antiga', 'Não Alcóolicas', 'Buffet especial', 'Serviço antigo']) {
    assert.ok(selects(html).some(select => select.includes(`selected="">${value}</option>`)), value)
  }
  for (const value of ['Descrição preservada', 'Observação preservada', 'Informação geral preservada']) assert.ok(html.includes(value), value)
  assert.equal(model.operationalPayload(event).brigada, event.brigada)
  assert.equal(model.operationalPayload(event).menu_bar, event.menu_bar)
  const readOnly = render(event, true)
  assert.equal(selects(readOnly).length, 0)
  assert.ok(readOnly.includes('Serviço antigo'))
})
