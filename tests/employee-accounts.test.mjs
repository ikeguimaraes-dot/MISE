import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import * as jsx from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadTs } from './helpers/load-ts.mjs'

const business = loadTs('src/lib/business-registration.ts')
const registration = loadTs('src/lib/employee-registration.ts', { '@/lib/business-registration': business })
const id = '11111111-1111-4111-8111-111111111111'
const roleId = '22222222-2222-4222-8222-222222222222'
const valid = { nome: ' Novo ', sobrenome: ' Usuário ', email: ' NOVO@EXAMPLE.COM ', password: 'Temporary-test-2026!', unit_id: id, role_id: roleId }
const json = { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) } }

function api(options = {}) {
  const calls = { service: 0, create: [], saved: [], removed: [], banned: [] }
  const db = {
    from(table) {
      return {
        select() { return this }, eq() { return this },
        maybeSingle: async () => options.lookupError ? { error: {} } : { data: options.missing ? null : table === 'roles' ? { id: roleId, name: 'founder', description: 'Acesso total' } : { id } },
        insert(body) { calls.saved.push(body); return this },
        single: async () => options.saveError ? { error: {} } : { data: { id: 'employee' } },
      }
    },
    auth: { admin: {
      createUser: async body => { calls.create.push(body); return options.authError ? { data: { user: null }, error: { code: options.authError } } : { data: { user: { id: 'new-auth-user' } } } },
      deleteUser: async userId => { calls.removed.push(userId); return { error: options.cleanupError ? {} : null } },
      updateUserById: async (...args) => { calls.banned.push(args); return { error: null } },
    } },
  }
  const route = loadTs('src/app/api/employees/route.ts', {
    'next/server': json,
    '@/lib/session': { requireMiseRole: async roles => roles.includes(options.role ?? 'admin') ? { employeeId: 'actor', role: options.role ?? 'admin' } : null },
    '@/lib/supabase/server': { createServiceClient: () => { calls.service++; return db } },
    '@/lib/employee-registration': registration,
  })
  return { calls, post: (body = valid) => route.POST({ json: async () => body }) }
}

test('criação de contas é restrita a administradores antes de acessar o banco', async () => {
  for (const role of ['gerente', 'cozinheiro', 'anonymous']) {
    const app = api({ role })
    assert.equal((await app.post()).status, 403)
    assert.equal(app.calls.service, 0)
  }
})

test('valida nome, email, senha, unidade e cargo antes de criar Auth', async () => {
  for (const body of [null, { ...valid, nome: '' }, { ...valid, email: 'invalido' }, { ...valid, password: 'short' }, { ...valid, role_id: 'founder' }, { ...valid, unit_id: '' }]) {
    const app = api()
    assert.equal((await app.post(body)).status, 400)
    assert.equal(app.calls.service, 0)
  }
})

test('unidade/cargo inexistentes ou falha de consulta não criam conta', async () => {
  for (const options of [{ missing: true }, { lookupError: true }]) {
    const app = api(options)
    assert.ok([400, 503].includes((await app.post()).status))
    assert.equal(app.calls.create.length, 0)
  }
})

test('cria Auth e funcionário com vínculo, cargo escolhido e acesso ativo, sem persistir senha no cadastro', async () => {
  const app = api()
  const result = await app.post({ ...valid, user_id: 'injected', ativo: false, mise_ativo: false, permissions: ['*'] })
  assert.equal(result.status, 201)
  assert.equal(result.body.id, 'employee')
  assert.equal(app.calls.create[0].email, 'novo@example.com')
  assert.equal(app.calls.create[0].email_confirm, true)
  const employee = app.calls.saved[0]
  assert.equal(employee.user_id, 'new-auth-user')
  assert.equal(employee.role_id, roleId)
  assert.equal(employee.unit_id, id)
  assert.equal(employee.funcao, 'Administrador master')
  assert.equal(employee.ativo, true)
  assert.equal(employee.mise_ativo, true)
  assert.equal('password' in employee, false)
  assert.equal(JSON.stringify(result).includes(valid.password), false)
})

test('e-mail duplicado e senha rejeitada não geram funcionários', async () => {
  for (const [code, status] of [['email_exists', 409], ['user_already_exists', 409], ['weak_password', 422]]) {
    const app = api({ authError: code })
    assert.equal((await app.post()).status, status)
    assert.equal(app.calls.saved.length, 0)
  }
})

test('falha no cadastro desfaz a criação no Auth; falha na compensação bloqueia o login órfão', async () => {
  for (const cleanupError of [false, true]) {
    const app = api({ saveError: true, cleanupError })
    assert.equal((await app.post()).status, 500)
    assert.deepEqual(app.calls.removed, ['new-auth-user'])
    assert.equal(app.calls.banned.length, cleanupError ? 1 : 0)
  }
})

test('PATCH de acesso exige admin e rejeita alteração de cargo ou identidade por payload arbitrário', async () => {
  for (const [role, body, expected] of [['gerente', { mise_ativo: true }, 403], ['admin', { mise_ativo: true, role_id: roleId }, 400], ['admin', { mise_ativo: true, user_id: 'injected' }, 400]]) {
    const route = loadTs('src/app/api/employees/[id]/route.ts', {
      'next/server': json, '@/lib/business-registration': business,
      '@/lib/session': { requireMiseRole: async allowed => allowed.includes(role) ? { role, employeeId: 'actor' } : null },
      '@/lib/supabase/server': { createServiceClient: () => { throw new Error('Unexpected mutation') } },
    })
    assert.equal((await route.PATCH({ json: async () => body }, { params: Promise.resolve({ id }) })).status, expected)
  }
})

test('sessões de email e PIN não autorizam funcionários desativados ou sem acesso MISE', async () => {
  for (const mode of ['email', 'pin']) for (const flags of [{ ativo: false, mise_ativo: true }, { ativo: true, mise_ativo: false }, { ativo: true, mise_ativo: true }]) {
    const service = {
      schema() { return this },
      from(table) {
        const filters = {}
        return {
          select() { return this }, eq(key, value) { filters[key] = value; return this },
          single: async () => {
            if (table === 'sessions') return { data: { id: 'session', employee_id: id, role: 'admin', expires_at: '2099-01-01' } }
            if (table === 'roles') return { data: { name: 'founder', permissions: [] } }
            return { data: Object.entries(filters).some(([key, value]) => key in flags && flags[key] !== value) ? null : { id, nome: 'Test', role_id: roleId } }
          },
        }
      },
    }
    const session = loadTs('src/lib/session.ts', {
      'next/headers': { cookies: async () => ({ get: () => mode === 'pin' ? { value: 'session' } : null }) },
      './supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: mode === 'email' ? { id: 'auth-user' } : null } }) } }), createServiceClient: () => service },
    })
    const result = await session.getMiseSession()
    assert.equal(result?.role ?? null, flags.ativo && flags.mise_ativo ? 'admin' : null)
  }
})

test('formulário oferece cadastro de login e escolha obrigatória de unidade/cargo', () => {
  const { EmployeeAccountForm } = loadTs('src/app/(dashboard)/cadastros/funcionarios/_components/employee-account-form.tsx', {
    'react/jsx-runtime': jsx, react: React, 'next/navigation': { useRouter: () => ({ refresh() {} }) },
  })
  const html = renderToStaticMarkup(React.createElement(EmployeeAccountForm, { units: [{ id, label: 'Unidade teste' }], roles: [{ id: roleId, label: 'Administrador master' }] }))
  assert.match(html, /Cadastrar novo usuário/)
  assert.match(html, /name="role_id" required/)
  assert.match(html, /name="unit_id" required/)
  assert.match(html, /type="password"/)
  assert.match(html, /Administrador master/)
})
