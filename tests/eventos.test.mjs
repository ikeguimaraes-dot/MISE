import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function adminRoute({ miseAdmin = true, validToken = true, role = 'admin' } = {}) {
  const calls = []
  const client = {
    auth: { getUser: async () => ({ data: { user: validToken ? { id: 'actor' } : null }, error: !validToken }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { nivel_acesso: role } }) }) }) }),
  }
  const source = fs.readFileSync(new URL('../src/app/api/eventos/admin/route.ts', import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  vm.runInNewContext(code, {
    exports, Request, Response, URL,
    process: { env: { EVENTOS_SUPABASE_SERVICE_ROLE_KEY: 'server-only-test-key' } },
    require: name => name === '@supabase/supabase-js' ? { createClient: () => client } : { requireMiseRole: async () => miseAdmin ? { role: 'admin' } : null },
    fetch: async (url, options) => { calls.push({ url, options }); return Response.json({ id: 'created' }) },
  })
  return { route: exports, calls }
}

const request = (path, body) => new Request(`http://localhost/api/eventos/admin?path=${encodeURIComponent(path)}`, {
  method: 'POST', headers: { Authorization: 'Bearer event-user-token', 'Content-Type': 'application/json' },
  body: JSON.stringify(body ?? { email: 'test@example.com', password: 'password123' }),
})

for (const [label, options, status] of [
  ['MISE sem permissão', { miseAdmin: false }, 403],
  ['token de eventos inválido', { validToken: false }, 401],
  ['perfil operacional', { role: 'operacional' }, 403],
]) test(`admin bloqueia ${label} antes de chamar API privilegiada`, async () => {
  const { route, calls } = adminRoute(options)
  assert.equal((await route.POST(request('/auth/v1/admin/users'))).status, status)
  assert.equal(calls.length, 0)
})

test('admin rejeita destinos fora da lista permitida', async () => {
  const { route, calls } = adminRoute()
  for (const path of ['/rest/v1/usuarios', '/auth/v1/admin/users/../settings', 'https://example.com']) {
    assert.equal((await route.POST(request(path))).status, 400)
  }
  assert.equal(calls.length, 0)
})

test('criação encaminha apenas campos permitidos e mantém chave no servidor', async () => {
  const { route, calls } = adminRoute()
  const response = await route.POST(request('/auth/v1/admin/users', {
    email: 'test@example.com', password: 'password123', app_metadata: { admin: true },
  }))
  assert.equal(response.status, 200)
  assert.equal(calls.length, 1)
  assert.deepEqual(JSON.parse(calls[0].options.body), { email: 'test@example.com', password: 'password123', email_confirm: true })
  assert.equal(calls[0].options.headers.apikey, 'server-only-test-key')
  assert.ok(!(await response.text()).includes('server-only-test-key'))
})

test('HTML importado contém JavaScript válido e nenhum JWT de serviço', () => {
  const html = fs.readFileSync(new URL('../eventos/index.html', import.meta.url), 'utf8')
  for (const [, script] of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(script)
  assert.ok(!html.includes('SUPABASE_SERVICE_KEY'))
  for (const [jwt] of html.matchAll(/eyJ[A-Za-z0-9_.-]+/g)) {
    assert.notEqual(JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).role, 'service_role')
  }
})
