import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import * as jsx from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadTs } from './helpers/load-ts.mjs'
const rules = loadTs('src/lib/shelf-life.ts')
const expiry = loadTs('src/lib/label-expiry.ts', { '@/lib/shelf-life': rules })
const business = loadTs('src/lib/business-registration.ts')
const products = loadTs('src/lib/product-registration.ts', { '@/lib/shelf-life': rules, '@/lib/business-registration': business })
const id = '11111111-1111-4111-8111-111111111111'
const json = { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) } }
const standard = { nome: 'Shari', categoria: 'shari', categoria_anvisa: 'shari', metodo_conservacao: 'Temperatura ambiente', prazo_validade_horas: 8, lote: 'L123', marca: 'Marca', sif: '1234', group_id: id, unidade_padrao: 'kg', ativo: true }

function harness({ role = 'cozinheiro', product = standard } = {}) {
  let saved
  const db = { schema() { return this }, from(table) {
    return { select() { return this }, eq() { return this },
      maybeSingle: async () => table === 'ingredients' ? { data: product } : { data: null },
      insert(data) { saved = data; return this }, update(data) { saved = data; return this },
      single: async () => ({ data: { id } }),
    }
  } }
  const server = loadTs('src/lib/shelf-life-server.ts', { '@/lib/shelf-life': rules, '@/lib/supabase/server': { createServiceClient: () => db } })
  const deps = { 'next/server': json, '@/lib/supabase/server': { createServiceClient: () => db }, '@/lib/session': { getMiseSession: async () => ({ role, employeeId: id }), requireMiseRole: async () => ({ role }) }, '@/lib/label-expiry': expiry, '@/lib/shelf-life-server': server, '@/lib/business-registration': business, '@/lib/product-registration': products }
  const api = loadTs('src/app/api/labels/route.ts', deps)
  const catalog = loadTs('src/lib/product-registration-server.ts', deps)
  return { post: data => api.POST({ json: async () => ({ ingredient_id: id, unit_id: id, tipo: 'ingrediente', ...data }) }), save: data => catalog.saveProduct({ json: async () => data }, id), saved: () => saved, server }
}

test('shari é 8h inclusive em ambiente; feitos/empanados são 24h sem ampliar no congelamento', () => {
  for (const method of ['Temperatura ambiente', 'Refrigerado até 4°C', 'Congelado -18°C']) assert.equal(rules.getShelfLifeRule('shari', method).prazo_horas, 8)
  for (const method of ['Refrigerado até 4°C', 'Congelado -18°C']) assert.equal(rules.getShelfLifeRule('feitos_empanados', method).prazo_horas, 24)
  assert.equal(rules.getShelfLifeRule('shari', 'Temperatura ambiente', 4).prazo_horas, 4)
  assert.ok(products.PRODUCT_CATEGORIES.includes('molhos'))
  assert.ok(products.PRODUCT_CATEGORIES.includes('ovos'))
})

test('funcionário usa relógio do servidor e cadastro mesmo enviando datas, método, categoria, marca ou SIF falsos', async () => {
  const app = harness(), before = Date.now()
  const result = await app.post({ data_manipulacao: '2000-01-01T00:00:00Z', validade: '2099-01-01', categoria_anvisa: 'pescado_cru', metodo_conservacao: 'Congelado abaixo de -18°C', sif: 'falso', marca: 'falsa', nome: 'falso' })
  assert.equal(result.status, 200)
  const saved = app.saved()
  assert.ok(new Date(saved.data_manipulacao).getTime() >= before)
  assert.ok(new Date(saved.data_manipulacao).getTime() <= Date.now())
  assert.equal(new Date(saved.validade) - new Date(saved.data_manipulacao), 8 * 3600000)
  for (const key of ['nome', 'marca', 'sif', 'lote', 'metodo_conservacao']) assert.equal(saved[key], standard[key])
  assert.equal(result.body.data_manipulacao, saved.data_manipulacao)
})

test('funcionário não define prazo; produto sem padrão requer admin; gerente também não altera configurações', async () => {
  for (const role of ['cozinheiro', 'gerente']) {
    for (const data of [{ prazo_horas: 1 }, { prazo_fabricante_horas: 100 }, { validade_manual: '2099-01-01' }]) {
      const app = harness({ role }); assert.equal((await app.post(data)).status, 403); assert.equal(app.saved(), undefined)
    }
  }
  const legacy = harness({ product: { ...standard, metodo_conservacao: null } })
  assert.equal((await legacy.post({})).status, 422)
  assert.equal(legacy.saved(), undefined)
  for (const change of [{ sif: '222' }, { marca: 'Outra' }, { metodo_conservacao: 'Refrigerado até 4°C' }, { prazo_validade_horas: 4 }]) {
    const app = harness({ role: 'gerente' }); assert.equal((await app.save({ ...standard, ...change })).status, 403); assert.equal(app.saved(), undefined)
  }
})

test('admin persiste padrão e lote; gerente mantém campos protegidos sem regravá-los', async () => {
  const admin = harness({ role: 'admin' }); assert.equal((await admin.save(standard)).status, 200)
  assert.equal(admin.saved().lote, 'L123'); assert.equal(admin.saved().prazo_validade_horas, 8)
  const manager = harness({ role: 'gerente' }); assert.equal((await manager.save({ ...standard, nome: 'Nome atualizado' })).status, 200)
  assert.equal(manager.saved().nome, 'Nome atualizado'); assert.equal('metodo_conservacao' in manager.saved(), false)
})

test('ambiente sem categoria funciona no cadastro; secos/ovos exigem prazo; lote e duração inválidos falham', () => {
  assert.equal(products.validateProduct({ ...standard, categoria: 'outro', categoria_anvisa: null }).metodo_conservacao, 'Temperatura ambiente')
  for (const categoria_anvisa of ['ovos', 'farinhas_feculas']) assert.throws(() => products.validateProduct({ ...standard, categoria_anvisa, prazo_validade_horas: null }), /fabricante/)
  for (const prazo_validade_horas of [0, -1, Infinity, true, 'texto']) assert.throws(() => products.validateProduct({ ...standard, prazo_validade_horas }))
  assert.throws(() => products.validateProduct({ ...standard, lote: 'x'.repeat(81) }))
})

test('prazo do fabricante salvo prevalece sobre requisição e vencimento do fornecedor limita a etiqueta', async () => {
  const app = harness({ product: { ...standard, categoria_anvisa: 'ovos', prazo_validade_horas: 12 } })
  assert.equal((await app.server.resolveShelfLifeRule({ ingredientId: id, method: 'Congelado -18°C', manufacturerHours: 999 })).prazo_horas, 12)
  const tomorrow = new Date(Date.now() + 3600000).toISOString()
  assert.equal((await app.post({ validade_fornecedor: tomorrow })).body.validade, tomorrow)
})

test('impressão com nome longo, marca, SIF e lote cabe em 60mm; formulário restringe padrão a admin', () => {
  const { buildTSPL } = loadTs('src/lib/etiqueta-tspl.ts', { '@/lib/label-expiry': expiry })
  const printed = buildTSPL({ ...standard, nome: 'Produto com nome extremamente longo '.repeat(8), metodo: standard.metodo_conservacao, id, dataManipulacao: new Date(), validade: new Date(), respNome: 'Ana' })
  assert.match(printed, /LOTE: L123/); assert.match(printed, /MARCA: Marca/)
  for (const [, y] of printed.matchAll(/TEXT \d+,(\d+),/g)) assert.ok(Number(y) + 20 < 480)
  const { ProdutoForm } = loadTs('src/app/(dashboard)/cadastros/produtos/_components/produto-form.tsx', { 'react/jsx-runtime': jsx, react: React, 'next/navigation': { useRouter: () => ({}) }, '@/lib/shelf-life': rules, '@/lib/product-registration': products })
  for (const isAdmin of [true, false]) {
    const html = renderToStaticMarkup(React.createElement(ProdutoForm, { initial: { ...standard, id }, isAdmin, groups: [], suppliers: [] }))
    assert.match(html, /value="L123"/)
    assert.equal(/id="product-conservation" disabled/.test(html), !isAdmin)
  }
})

test('emissão do funcionário mostra conservação bloqueada e manipulação automática, sem editores de prazo', async () => {
  const icons = await import('lucide-react')
  const { LabelForm } = loadTs('src/app/(dashboard)/etiquetas/_components/label-form.tsx', {
    react: React, 'react/jsx-runtime': jsx, 'lucide-react': icons,
    '@/lib/label-expiry': expiry, '@/lib/shelf-life': rules,
    '@/lib/etiqueta-tspl': {}, '@/components/ui/date-picker': { DatePicker: () => null },
  })
  const html = renderToStaticMarkup(React.createElement(LabelForm, { isAdmin: false, ingredients: [{ ...standard, id }], initialProductId: id, menuItems: [], responsaveis: [], units: [] }))
  assert.match(html, /<select disabled="" id="label-conservation-method"/)
  assert.match(html, /Automática: data e hora da emissão/)
  assert.doesNotMatch(html, /id="label-duration-hours"/)
  assert.doesNotMatch(html, /id="label-manual-expiry"/)
  assert.match(html, /value="L123"/)
})
