import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function load(path, dependencies = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Date, Number, Error, URL, Request,
    require(name) { if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`); return dependencies[name] },
  })
  return exports
}
const rules = load('src/lib/shelf-life.ts')

test('categoria seleciona automaticamente uma refrigeração compatível e calculável', () => {
  assert.equal(rules.getDefaultConservationMethod('pescado_cozido'), 'Refrigerado até 2°C')
  assert.equal(rules.getDefaultConservationMethod('proteina_animal_crua'), 'Refrigerado até 4°C')
  assert.equal(rules.getDefaultConservationMethod('vegetal_cru'), 'Refrigerado até 5°C')
  for (const category of rules.FOOD_CATEGORIES.filter(item => item.hours !== null)) {
    assert.equal(rules.getShelfLifeRule(category.value, rules.getDefaultConservationMethod(category.value)).prazo_horas, category.hours)
  }
  for (const missing of [null, undefined, '', 'desconhecida']) assert.equal(rules.getDefaultConservationMethod(missing), '')
})

test('impressão Bluetooth preserva data e hora do vencimento sem ultrapassar a etiqueta', () => {
  const print = load('src/lib/etiqueta-tspl.ts')
  const tspl = print.buildTSPL({ nome: 'Pescado cozido com um nome comprido para ocupar cinco linhas na etiqueta', metodo: 'Congelado abaixo de -18°C', dataManipulacao: '2026-11-13T13:00:00Z', validade: '2026-11-14T13:30:00Z', respNome: 'Ana', id: '123456' })
  assert.match(tspl, /14\/11\/26/)
  assert.match(tspl, /ATE 10:30/)
  for (const [, y] of tspl.matchAll(/TEXT \d+,(\d+),/g)) assert.ok(Number(y) + 20 < 480)
})

test('refrigeração aplica prazos e limites térmicos da categoria', () => {
  const categories = [
    ['pescado_cozido', 24, 2], ['pescado_cru', 72, 2],
    ['carne_preparada_crua', 48, 4], ['maionese', 48, 4],
    ['proteina_animal_crua', 72, 4], ['proteina_animal_cozida', 72, 4],
    ['frios_embutidos', 72, 4], ['vegetal_cozido', 72, 4],
    ['sobremesa', 72, 4], ['laticinios', 72, 4], ['vegetal_cru', 72, 5],
    ['arroz_massa_cereais', 72, 4], ['molho_caldo', 72, 4], ['fritura', 72, 4],
  ]
  for (const [category, hours, max] of categories) {
    for (const temperature of [2, 4, 5]) {
      if (temperature > max) assert.throws(() => rules.getShelfLifeRule(category, `Refrigerado até ${temperature}°C`), /no máximo/)
      else assert.equal(rules.getShelfLifeRule(category, `Refrigerado até ${temperature}°C`).prazo_horas, hours)
    }
  }
})

test('congelamento distingue as quatro faixas e -18°C não recebe 90 dias', () => {
  for (const [method, days] of [['Congelado de 0 a -5°C', 10], ['Congelado de -6 a -10°C', 20], ['Congelado de -11 a -18°C', 30], ['Congelado abaixo de -18°C', 90], ['Congelado -18°C', 30]]) {
    assert.equal(rules.getShelfLifeRule('pescado_cru', method).prazo_horas, days * 24)
  }
})

test('pós-cocção mantém o piso nacional de congelamento a -18°C', () => {
  for (const method of ['Congelado de 0 a -5°C', 'Congelado de -6 a -10°C', 'Congelado de -11 a -18°C']) assert.throws(() => rules.getShelfLifeRule('pescado_cozido', method), /pós-cocção/)
  assert.equal(rules.getShelfLifeRule('pescado_cozido', 'Congelado -18°C').prazo_horas, 720)
  assert.equal(rules.getShelfLifeRule('pescado_cozido', 'Congelado abaixo de -18°C').prazo_horas, 2160)
})

test('regras antigas e prazos de produto não ampliam limites nem liberam temperatura incompatível', () => {
  assert.equal(rules.getShelfLifeRule('vegetal_cru', 'Resfriado 0-5°C').prazo_horas, 72)
  assert.throws(() => rules.getShelfLifeRule('pescado_cru', 'Resfriado 0-5°C'), /no máximo 2/)
  assert.throws(() => rules.getShelfLifeRule('pescado_cru', 'Refrigerado 5-10°C', 1))
  assert.equal(rules.getShelfLifeRule('pescado_cozido', 'Refrigerado até 2°C', 1000).prazo_horas, 24)
  assert.equal(rules.getShelfLifeRule('pescado_cozido', 'Refrigerado até 2°C', 12).prazo_horas, 12)
  assert.equal(rules.getShelfLifeRule('pescado_cozido', 'Refrigerado até 2°C', -1).prazo_horas, 24)
})

test('não inventa prazo para ambiente, categoria ausente, categoria desconhecida ou método ausente', () => {
  assert.throws(() => rules.getShelfLifeRule('vegetal_cru', 'Temperatura ambiente', 720), /não possui prazo genérico/)
  for (const category of ['', null, 'desconhecida']) assert.throws(() => rules.getShelfLifeRule(category, 'Congelado -18°C'), /categoria/)
  assert.throws(() => rules.getShelfLifeRule('vegetal_cru', ''), /Método/)
})

test('cálculo usa a manipulação em São Paulo, cruza mês/ano e respeita o fornecedor', () => {
  assert.equal(rules.calculateExpiry('2026-12-31T23:00', 24), '2027-01-02T02:00:00.000Z')
  assert.equal(rules.expiryToLocalInput(rules.calculateExpiry('2026-11-13T10:00', 72)), '2026-11-16T10:00')
  assert.equal(rules.calculateExpiry('2026-11-13T13:00:00Z', 72), '2026-11-16T13:00:00.000Z')
  assert.equal(rules.calculateExpiry('2026-11-13T10:00', 72, '2026-11-14'), '2026-11-15T02:59:59.999Z')
  assert.equal(rules.calculateExpiry('2026-11-13T10:00', 24, '2026-11-20'), '2026-11-14T13:00:00.000Z')
  assert.throws(() => rules.calculateExpiry('2026-11-13T10:00', 72, '2026-11-12'), /posterior/)
  assert.throws(() => rules.calculateExpiry('invalid', 72), /inválido/)
})

test('o cadastro prevalece sobre categoria enviada e falhas no banco não liberam prazo', async () => {
  const results = { ingredients: { data: { categoria_anvisa: 'pescado_cozido' } }, ingredient_shelf_life: { data: { prazo_horas: 200 } } }
  const query = table => ({ select() { return this }, eq() { return this }, maybeSingle() { return Promise.resolve(results[table]) } })
  const db = { from: query, schema() { return this } }
  const server = load('src/lib/shelf-life-server.ts', { '@/lib/shelf-life': rules, '@/lib/supabase/server': { createServiceClient: () => db } })
  const input = { method: 'Refrigerado até 2°C', category: 'vegetal_cru', ingredientId: 'product' }
  assert.equal((await server.resolveShelfLifeRule(input)).prazo_horas, 24)
  results.ingredient_shelf_life = { error: { message: 'unavailable' } }
  await assert.rejects(server.resolveShelfLifeRule(input), /Não foi possível/)
})

test('POST recalcula validade no servidor e não persiste prazo manipulado nem categoria auxiliar', async () => {
  let inserted
  const db = { schema() { return this }, from() { return this }, insert(body) { inserted = body; return this }, select() { return this }, single: async () => ({ data: { id: 'label' } }) }
  const api = load('src/app/api/labels/route.ts', {
    '@/lib/supabase/server': { createServiceClient: () => db },
    '@/lib/shelf-life': rules,
    '@/lib/shelf-life-server': { resolveShelfLifeRule: async ({ method, category }) => rules.getShelfLifeRule(category, method) },
    'next/server': { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) } },
  })
  const payload = { categoria_anvisa: 'pescado_cozido', metodo_conservacao: 'Refrigerado até 2°C', data_manipulacao: '2026-11-13T13:00:00Z', validade: '2030-01-01T00:00:00Z' }
  const response = await api.POST({ json: async () => payload })
  assert.equal(response.status, 200)
  assert.equal(inserted.validade, '2026-11-14T13:00:00.000Z')
  assert.equal('categoria_anvisa' in inserted, false)
  inserted = null
  const invalid = await api.POST({ json: async () => ({ ...payload, metodo_conservacao: 'Refrigerado até 5°C' }) })
  assert.equal(invalid.status, 422)
  assert.equal(inserted, null)
})


test('ingredientes secos exigem prazo do fabricante e não herdam prazos de perecíveis', () => {
  for (const category of rules.FOOD_CATEGORIES.filter(item => item.hours === null)) {
    assert.equal(rules.requiresManufacturerShelfLife(category.value), true)
    assert.equal(rules.getDefaultConservationMethod(category.value), '')
    for (const method of ['Temperatura ambiente', 'Refrigerado até 4°C', 'Congelado -18°C']) {
      for (const hours of [null, undefined, 0, -1, NaN, Infinity, '168']) {
        assert.throws(() => rules.getShelfLifeRule(category.value, method, null, hours), /prazo após abertura/)
      }
      const result = rules.getShelfLifeRule(category.value, method, null, 168)
      assert.equal(result.prazo_horas, 168)
      assert.equal(result.source, 'manufacturer')
      assert.equal(rules.getShelfLifeRule(category.value, method, 24, 168).prazo_horas, 24)
      assert.equal(rules.getShelfLifeRule(category.value, method, 720, 168).prazo_horas, 168)
    }
    assert.throws(() => rules.getShelfLifeRule(category.value, '', null, 168), /método/)
  }
  assert.equal(rules.requiresManufacturerShelfLife('vegetal_cru'), false)
  assert.throws(() => rules.getShelfLifeRule('vegetal_cru', 'Temperatura ambiente', null, 168), /não possui prazo genérico/)
})

test('API recalcula farinha de amêndoa e remove prazo auxiliar antes de persistir', async () => {
  let inserted
  const db = { schema() { return this }, from() { return this }, insert(body) { inserted = body; return this }, select() { return this }, single: async () => ({ data: { id: 'label' } }) }
  const api = load('src/app/api/labels/route.ts', {
    '@/lib/supabase/server': { createServiceClient: () => db },
    '@/lib/shelf-life': rules,
    '@/lib/shelf-life-server': { resolveShelfLifeRule: async ({ method, category, manufacturerHours }) => rules.getShelfLifeRule(category, method, null, manufacturerHours) },
    'next/server': { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) } },
  })
  const payload = { categoria_anvisa: 'farinhas_feculas', prazo_fabricante_horas: 168, metodo_conservacao: 'Temperatura ambiente', data_manipulacao: '2026-11-13T13:00:00Z', validade_fornecedor: '2026-11-14', validade: '2030-01-01T00:00:00Z' }
  assert.equal((await api.POST({ json: async () => payload })).status, 200)
  assert.equal(inserted.validade, '2026-11-15T02:59:59.999Z')
  assert.equal('prazo_fabricante_horas' in inserted, false)
  inserted = null
  assert.equal((await api.POST({ json: async () => ({ ...payload, prazo_fabricante_horas: null }) })).status, 422)
  assert.equal(inserted, null)
})


test('ambiente sem categoria recebe sete dias pela regra operacional e respeita limites menores', () => {
  for (const category of [null, undefined, '', '   ']) {
    const rule = rules.getShelfLifeRule(category, 'Temperatura ambiente')
    assert.equal(rule.prazo_horas, 168)
    assert.equal(rule.source, 'operational')
    assert.equal(rules.getShelfLifeRule(category, 'Temperatura ambiente', 24).prazo_horas, 24)
    assert.equal(rules.getShelfLifeRule(category, 'Temperatura ambiente', 720).prazo_horas, 168)
    assert.equal(rules.calculateExpiry('2026-11-13T10:00', rule.prazo_horas), '2026-11-20T13:00:00.000Z')
    assert.equal(rules.calculateExpiry('2026-11-13T10:00', rule.prazo_horas, '2026-11-14'), '2026-11-15T02:59:59.999Z')
  }
  assert.throws(() => rules.getShelfLifeRule('desconhecida', 'Temperatura ambiente'), /categoria/)
  assert.throws(() => rules.getShelfLifeRule(null, 'Refrigerado até 4°C'), /categoria/)
})

test('cadastro com categoria não permite forçar sete dias omitindo a categoria na requisição', async () => {
  const results = { ingredients: { data: { categoria_anvisa: 'pescado_cozido' } }, ingredient_shelf_life: { data: null } }
  const query = table => ({ select() { return this }, eq() { return this }, maybeSingle() { return Promise.resolve(results[table]) } })
  const db = { from: query, schema() { return this } }
  const server = load('src/lib/shelf-life-server.ts', { '@/lib/shelf-life': rules, '@/lib/supabase/server': { createServiceClient: () => db } })
  const input = { method: 'Temperatura ambiente', category: '', ingredientId: 'product' }
  await assert.rejects(server.resolveShelfLifeRule(input), /não possui prazo genérico/)
  results.ingredients.data.categoria_anvisa = null
  assert.equal((await server.resolveShelfLifeRule(input)).prazo_horas, 168)
})
