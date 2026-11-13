import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function load(path, dependencies = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Date, URL, require(name) { if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`); return dependencies[name] } })
  return exports
}
const business = load('src/lib/business-registration.ts')
const shelf = load('src/lib/shelf-life.ts')
const products = load('src/lib/product-registration.ts', { '@/lib/business-registration': business, '@/lib/shelf-life': shelf })
const model = load('src/lib/label-validities.ts')
const u1 = '00000000-0000-4000-8000-000000000001'
const u2 = '00000000-0000-4000-8000-000000000002'
const id = '00000000-0000-4000-8000-000000000003'
const jsonResponse = { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } }
const now = new Date('2026-11-13T15:00:00Z')

test('produto salva unidade normalizada, categoria sanitária e custo zero quando não informado', async () => {
  let stored
  const db = { from: () => ({ insert(data) { stored = data; return this }, select() { return this }, single: async () => ({ data: { id } }) }) }
  const api = load('src/lib/product-registration-server.ts', { 'next/server': jsonResponse, '@/lib/session': { requireMiseRole: async () => ({ role: 'admin' }) }, '@/lib/supabase/server': { createServiceClient: () => db }, '@/lib/business-registration': business, '@/lib/product-registration': products })
  const result = await api.saveProduct({ json: async () => ({ nome: 'Produto novo', group_id: u1, categoria: 'laticinios', categoria_anvisa: 'laticinios', unidade_padrao: 'L', custo_padrao: null, ativo: true, id: 'injetado' }) })
  assert.equal(result.status, 201)
  assert.equal(stored.unidade_padrao, 'l')
  assert.equal(stored.custo_padrao, 0)
  assert.equal(stored.categoria_anvisa, 'laticinios')
  assert.equal('id' in stored, false)
  assert.throws(() => products.validateProduct({ nome: 'Produto', group_id: u1, categoria: 'outro', unidade_padrao: 'litroo', ativo: true }))
})

function actionHarness({ session = true, fail = false, initial = 'ativa', exists = true } = {}) {
  const row = { id, status: initial, unit_id: u1, nome: 'Produto original' }
  let writes = 0
  let dbCalls = 0
  const db = { schema() { return this }, from() {
    let changes
    return { update(data) { changes = data; return this }, select() { return this }, eq() { return this }, in() { return this }, async maybeSingle() {
      if (fail) return { error: { message: 'database unavailable' } }
      if (!exists) return { data: null }
      if (changes) {
        if (!['ativa', 'vencida'].includes(row.status)) return { data: null }
        Object.assign(row, changes); writes++
      }
      return { data: { ...row } }
    } }
  } }
  const api = load('src/app/api/labels/[id]/route.ts', { 'next/server': jsonResponse, '@/lib/supabase/server': { createServiceClient: () => { dbCalls++; return db } }, '@/lib/session': { getMiseSession: async () => session ? { role: 'cozinheiro' } : null }, '@/lib/business-registration': business })
  const action = status => api.PATCH({ json: async () => ({ status, nome: 'Tentativa de mudar o nome' }) }, { params: Promise.resolve({ id }) })
  return { action, row, writes: () => writes, dbCalls: () => dbCalls }
}

test('usado e perda persistem inclusive em etiquetas vencidas e não reabrem nem contam duas vezes', async () => {
  for (const status of ['consumida', 'descartada']) {
    const testCase = actionHarness({ initial: 'vencida' })
    assert.equal((await testCase.action(status)).status, 200)
    assert.equal(testCase.row.status, status)
    assert.equal(testCase.row.nome, 'Produto original')
    const repeated = await testCase.action(status)
    assert.equal(repeated.status, 200)
    assert.equal(repeated.body.changed, false)
    assert.equal(testCase.writes(), 1)
    assert.equal((await testCase.action(status === 'consumida' ? 'descartada' : 'consumida')).status, 409)
    assert.equal(testCase.row.status, status)
  }
})

test('falhas, sessão expirada e etiqueta inexistente não retornam sucesso nem alteram estado', async () => {
  const failed = actionHarness({ fail: true })
  assert.equal((await failed.action('consumida')).status, 400)
  assert.equal(failed.row.status, 'ativa')
  const denied = actionHarness({ session: false })
  assert.equal((await denied.action('descartada')).status, 401)
  assert.equal(denied.dbCalls(), 0)
  assert.equal((await actionHarness({ exists: false }).action('consumida')).status, 404)
  assert.equal((await actionHarness().action('ativa')).status, 400)
})

function databaseFixture() {
  const tables = { labels: [], units: [{ id: u1, name: 'Unidade 1', active: true }, { id: u2, name: 'Unidade 2', active: false }], employees: [] }
  let sequence = 0
  const add = (unit, status, validade, amount = 1) => { for (let n = 0; n < amount; n++) tables.labels.push({ id: String(sequence++).padStart(5, '0'), unit_id: unit, status, validade, nome: 'Produto', employee_id: null, responsavel_nome: 'Ana', data_manipulacao: '2026-11-01T12:00:00Z' }) }
  add(u1, 'ativa', '2026-11-01T15:00:00Z', 1250)
  add(u2, 'ativa', '2026-11-01T15:00:00Z', 2)
  add(u1, 'ativa', '2026-11-13T20:00:00Z')
  add(u1, 'ativa', '2026-11-14T20:00:00Z')
  add(u1, 'ativa', '2026-11-15T20:00:00Z')
  add(u1, 'ativa', '2026-11-20T20:00:00Z')
  add(u1, 'consumida', '2026-11-01T15:00:00Z', 3)
  add(u2, 'consumida', '2026-11-01T15:00:00Z')
  add(u1, 'descartada', '2026-11-01T15:00:00Z', 2437)
  let headQueries = 0
  const db = { schema() { return this }, from(table) {
    const filters = []; const orders = []; let range; let head = false
    return {
      select(_, options) { head = options?.head ?? false; if (head) headQueries++; return this },
      eq(field, value) { filters.push(row => row[field] === value); return this },
      in(field, values) { filters.push(row => values.includes(row[field])); return this },
      or(value) { const current = value.split('validade.lte.')[1]; filters.push(row => row.status === 'vencida' || row.validade <= current); return this },
      gt(field, value) { filters.push(row => row[field] > value); return this },
      gte(field, value) { filters.push(row => row[field] >= value); return this },
      lt(field, value) { filters.push(row => row[field] < value); return this },
      order(field, options) { orders.push([field, options?.ascending !== false]); return this },
      range(from, to) { range = [from, to]; return this },
      then(resolve, reject) {
        let rows = tables[table].filter(row => filters.every(filter => filter(row)))
        const count = rows.length
        rows.sort((left, right) => { for (const [field, ascending] of orders) { const compared = String(left[field]).localeCompare(String(right[field])); if (compared) return ascending ? compared : -compared } return 0 })
        if (range) rows = rows.slice(range[0], range[1] + 1)
        return Promise.resolve({ data: head ? null : rows, count, error: null }).then(resolve, reject)
      },
    }
  } }
  const server = load('src/lib/label-validities-server.ts', { '@/lib/supabase/server': { createServiceClient: () => db }, '@/lib/label-validities': model })
  return { tables, server, headQueries: () => headQueries }
}

test('contadores consultam todos os registros, acima de 1000, e a lista tem paginação', async () => {
  const fixture = databaseFixture()
  const data = await fixture.server.loadValidities({ unit: '', bucket: '', page: 1 }, now)
  assert.equal(data.counts.vencidos, 1252)
  assert.equal(data.counts.consumida, 4)
  assert.equal(data.counts.descartada, 2437)
  assert.equal(data.total, 1256)
  assert.equal(data.labels.length, 20)
  assert.equal(data.labels[0].employee_name, 'Ana')
  assert.equal(fixture.headQueries(), 6)
  const last = await fixture.server.loadValidities({ unit: '', bucket: '', page: 999 }, now)
  assert.equal(last.page, 63)
  assert.equal(last.labels.length, 16)
})

test('filtro de unidade e histórico excluem consumidas/perdas dos vencidos após recarregar', async () => {
  const fixture = databaseFixture()
  const before = await fixture.server.loadValidities({ unit: u1, bucket: 'vencidos', page: 1 }, now)
  const id = before.labels[0].id
  const confirmed = model.applyConfirmedLabelAction(before, id, 'consumida')
  assert.equal(confirmed.counts.vencidos, 1249)
  assert.equal(confirmed.counts.consumida, 4)
  assert.equal(confirmed.labels.some(row => row.id === id), false)
  assert.equal(model.applyConfirmedLabelAction(confirmed, id, 'consumida'), confirmed)
  fixture.tables.labels.find(row => row.id === id).status = 'consumida'
  const reloaded = await fixture.server.loadValidities({ unit: u1, bucket: 'vencidos', page: 1 }, now)
  assert.equal(reloaded.counts.vencidos, 1249)
  assert.equal(reloaded.counts.consumida, 4)
  const history = await fixture.server.loadValidities({ unit: u1, bucket: 'consumida', page: 1 }, now)
  assert.equal(history.total, 4)
  assert.ok(history.labels.every(row => row.status === 'consumida'))
  const other = await fixture.server.loadValidities({ unit: u2, bucket: '', page: 1 }, now)
  assert.equal(other.counts.descartada, 0)
  assert.equal(other.total, 2)
})

test('virada de dia usa São Paulo e itens finalizados não entram nos vencidos', () => {
  const midnight = new Date('2026-11-14T02:30:00Z')
  assert.equal(model.startOfDaySP(midnight, 1), '2026-11-14T03:00:00.000Z')
  assert.equal(model.getValidityBucket({ status: 'ativa', validade: '2026-11-14T02:45:00Z' }, midnight), 'hoje')
  assert.equal(model.getValidityBucket({ status: 'consumida', validade: '2020-01-01T00:00:00Z' }, now), 'consumida')
})
