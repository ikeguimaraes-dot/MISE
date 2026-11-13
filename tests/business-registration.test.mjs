import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as jsxRuntime from 'react/jsx-runtime'

function load(path, dependencies = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, URL, Date,
    require(name) { if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`); return dependencies[name] },
  })
  return exports
}
const model = load('src/lib/business-registration.ts')
const companyId = '00000000-0000-4000-8000-000000000001'
const recordId = '00000000-0000-4000-8000-000000000002'
const valid = { name: 'Restaurante exemplo', legal_name: 'Empresa exemplo LTDA', cnpj: '11.222.333/0001-81', postal_code: '01001-000', street: 'Praça da Sé', street_number: 'S/N', district: 'Sé', city: 'São Paulo', state: 'SP', active: true }

test('CNPJ numérico e alfanumérico seguem os vetores da Receita Federal', () => {
  for (const cnpj of ['11.222.333/0001-81', '11222333000181', '00.000.000/E08G-12', '00.000.000/e08g-12']) assert.equal(model.isValidCnpj(cnpj), true, cnpj)
  for (const cnpj of ['11.222.333/0001-82', '00.000.000/E08G-13', '00000000000000', '11111111111111', '123', '11222333000181!', '11.222.333/0001-AA']) assert.equal(model.isValidCnpj(cnpj), false, cnpj)
  assert.equal(model.formatCnpj('00000000E08G12'), '00.000.000/E08G-12')
})

test('cadastro normaliza campos, limita o payload e mantém o vínculo de unidade', () => {
  const data = model.validateBusinessRegistration({ ...valid, company_id: companyId, phone: '(11) 99999-9999', cnae: '5611-2/01', website: 'exemplo.com.br', id: 'injected', brand_id: 'injected', is_training: true, created_at: 'old' }, 'unidade')
  assert.equal(data.cnpj, '11222333000181')
  assert.equal(data.postal_code, '01001000')
  assert.equal(data.cnae, '5611201')
  assert.equal(data.company_id, companyId)
  assert.equal(data.whatsapp_number, '(11) 99999-9999')
  assert.match(data.address, /Praça da Sé, S\/N.*São Paulo\/SP/)
  assert.equal(data.website, 'https://exemplo.com.br/')
  for (const field of ['id', 'brand_id', 'is_training', 'created_at']) assert.equal(field in data, false)
  assert.equal('company_id' in model.validateBusinessRegistration({ ...valid, company_id: companyId }, 'empresa'), false)
})

test('campos obrigatórios, CNPJ, CEP, UF e empresa são validados', () => {
  for (const field of ['name', 'legal_name', 'cnpj', 'postal_code', 'street', 'street_number', 'district', 'city', 'state']) assert.throws(() => model.validateBusinessRegistration({ ...valid, [field]: '' }, 'empresa'))
  for (const change of [{ cnpj: '000' }, { postal_code: '000' }, { state: 'XX' }, { active: 'true' }, { email: 'invalid' }, { cnae: '000' }, { website: 'javascript:alert(1)' }, { name: 'x'.repeat(251) }]) assert.throws(() => model.validateBusinessRegistration({ ...valid, ...change }, 'empresa'))
  assert.throws(() => model.validateBusinessRegistration(valid, 'unidade'), /empresa/)
  assert.throws(() => model.validateBusinessRegistration(null, 'empresa'))
})

function apiHarness({ allowed = true, companyExists = true, duplicate = false, dbError, found = true } = {}) {
  const writes = []
  let dbCalls = 0
  const db = { schema() { return this }, from(table) {
    const state = { table, operation: 'read', data: null }
    return {
      select() { return this }, eq() { return this }, neq() { return this }, in() { return this },
      update(data) { state.operation = 'update'; state.data = data; return this },
      insert(data) { state.operation = 'insert'; state.data = data; return this },
      limit: async () => ({ data: duplicate ? [{ id: 'existing' }] : [] }),
      async maybeSingle() { if (state.operation === 'read') return { data: companyExists ? { id: companyId } : null }; writes.push(state); return { data: found ? { id: recordId } : null, error: dbError } },
      async single() { writes.push(state); return { data: { id: recordId }, error: dbError } },
    }
  } }
  const api = load('src/lib/business-registration-server.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    '@/lib/session': { requireMiseRole: async roles => allowed && roles.join() === 'admin' ? { role: 'admin' } : null },
    '@/lib/supabase/server': { createServiceClient: () => { dbCalls++; return db } },
    '@/lib/business-registration': model,
  })
  return { api, writes, dbCalls: () => dbCalls }
}

test('API exige administrador e impede gravações com payload inválido', async () => {
  const denied = apiHarness({ allowed: false })
  assert.equal((await denied.api.saveBusinessRegistration({ json: async () => valid }, 'empresa')).status, 403)
  assert.equal(denied.dbCalls(), 0)
  const invalid = apiHarness()
  assert.equal((await invalid.api.saveBusinessRegistration({ json: async () => ({ ...valid, cnpj: 'invalid' }) }, 'empresa')).status, 400)
  assert.equal(invalid.dbCalls(), 0)
})

test('API salva empresa e unidade com dados completos, sem recriar a unidade na edição', async () => {
  const { api, writes } = apiHarness()
  const company = await api.saveBusinessRegistration({ json: async () => ({ ...valid, notes: 'Observação' }) }, 'empresa')
  assert.equal(company.status, 201)
  assert.equal(writes[0].table, 'companies')
  assert.equal(writes[0].data.legal_name, valid.legal_name)
  assert.equal(writes[0].data.cnpj, '11222333000181')
  const unit = await api.saveBusinessRegistration({ json: async () => ({ ...valid, company_id: companyId }) }, 'unidade', recordId)
  assert.equal(unit.status, 200)
  assert.equal(writes[1].operation, 'update')
  assert.equal(writes[1].table, 'units')
  assert.equal(writes[1].data.company_id, companyId)
})

test('API rejeita empresa inexistente e CNPJ duplicado; id inexistente não vira criação', async () => {
  const request = { json: async () => ({ ...valid, company_id: companyId }) }
  for (const [options, expected] of [[{ companyExists: false }, 400], [{ duplicate: true }, 409]]) {
    const harness = apiHarness(options)
    assert.equal((await harness.api.saveBusinessRegistration(request, 'unidade')).status, expected)
    assert.equal(harness.writes.length, 0)
  }
  const conflict = apiHarness({ dbError: { code: '23505' } })
  assert.equal((await conflict.api.saveBusinessRegistration(request, 'empresa')).status, 409)
  const missing = apiHarness({ found: false })
  assert.equal((await missing.api.saveBusinessRegistration(request, 'unidade', recordId)).status, 404)
})

test('formulário de unidade carrega vínculo, CNPJ, endereço e contato salvos', () => {
  const { BusinessForm } = load('src/components/business/business-form.tsx', {
    react: React, 'react/jsx-runtime': jsxRuntime,
    'next/navigation': { useRouter: () => ({}) },
    'next/link': { __esModule: true, default: props => React.createElement('a', props) },
    '@/lib/business-registration': model,
  })
  const html = renderToStaticMarkup(React.createElement(BusinessForm, { kind: 'unidade', initial: { ...valid, id: recordId, company_id: companyId, email: 'contato@exemplo.com.br' }, companies: [{ id: companyId, name: 'Empresa exemplo', active: true }] }))
  assert.match(html, /11\.222\.333\/0001-81/)
  assert.match(html, /contato@exemplo\.com\.br/)
  assert.match(html, /Praça da Sé/)
  assert.match(html, /selected=""/)
  assert.match(html, /Salvar alterações/)
})
