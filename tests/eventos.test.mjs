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

function eventosFunction(start, end, globals) {
  const html = fs.readFileSync(new URL('../eventos/index.html', import.meta.url), 'utf8')
  const source = html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)))
  const context = vm.createContext(globals)
  vm.runInContext(source, context)
  return context
}

test('ambientes permitem seleção múltipla, preservam registros antigos e limpam ao trocar casa', () => {
  const element = () => ({ children: [], style: {}, append(...children) { this.children.push(...children) }, replaceChildren() { this.children = [] }, addEventListener() {} })
  const casa = { value: 'MEET & EAT' }
  const hidden = { value: '' }
  const container = element()
  const inputs = () => container.children.flatMap(label => label.children).filter(node => node.type === 'checkbox')
  const context = eventosFunction('    const AMBIENTES_POR_CASA', '    function resetForm()', {
    document: {
      getElementById: id => ({ 'f-casa': casa, 'f-espacos': hidden, 'f-ambientes': container })[id],
      createElement: element,
      querySelectorAll: () => inputs().filter(input => input.checked),
    },
    atualizarResumo() {},
  })
  for (const [house, expected] of Object.entries({
    'MEET & EAT': ['Salão Térreo', 'Bar Secreto', 'Rooftop'],
    Match: ['Salão Térreo'], 'MADONNA CUCINA': ['Salão Térreo', 'Superior'],
    'Frêneze': ['Salão Térreo', 'Sala 33', 'Deck'],
  })) {
    casa.value = house
    context.atualizarAmbientes()
    assert.deepEqual(inputs().map(o => o.value), expected)
  }
  inputs()[0].checked = true
  inputs()[2].checked = true
  context.sincronizarAmbientes()
  assert.equal(hidden.value, 'Salão Térreo\nDeck')
  context.atualizarAmbientes(hidden.value)
  assert.deepEqual(inputs().filter(o => o.checked).map(o => o.value), ['Salão Térreo', 'Deck'])
  inputs()[0].checked = false
  context.sincronizarAmbientes()
  assert.equal(hidden.value, 'Deck')
  context.atualizarAmbientes('Espaço antigo / área reservada')
  assert.equal(hidden.value, 'Espaço antigo / área reservada')
  casa.value = 'Match'
  context.atualizarAmbientes()
  assert.equal(hidden.value, '')
  assert.equal(inputs().length, 1)
  casa.value = ''
  context.atualizarAmbientes()
  assert.equal(inputs().length, 0)
  assert.equal(hidden.value, '')
})

test('cabeçalho mostra a casa e todos os ambientes selecionados', () => {
  const elements = Object.fromEntries(['f-nome', 'f-casa', 'f-espacos', 'resumo-nome', 'resumo-casa', 'resumo-espaco', 'resumo-data', 'resumo-dia', 'resumo-horario', 'resumo-pax'].map(id => [id, { style: {} }]))
  elements['f-casa'].value = 'MEET & EAT'
  elements['f-espacos'].value = 'Salão Térreo\nRooftop'
  const context = eventosFunction('    function atualizarResumo()', '    // Verificar sessão ao carregar', {
    document: { getElementById: id => elements[id] },
  })
  context.atualizarResumo()
  assert.equal(elements['resumo-casa'].textContent, 'MEET & EAT')
  assert.equal(elements['resumo-espaco'].textContent, 'Salão Térreo • Rooftop')
  assert.equal(elements['resumo-nome'].style.display, 'none')
})

test('dashboard filtra a consulta por casa e atualiza os indicadores e a tabela', async () => {
  const elements = { 'dashboard-casa': { value: 'Match' } }
  for (const id of ['stat-total', 'stat-confirmados', 'stat-rascunhos', 'stat-realizados']) elements[id] = {}
  const events = [{ casa: 'Match', status: 'confirmado' }, { casa: 'Frêneze', status: 'rascunho' }]
  let rendered
  const context = eventosFunction('    async function loadDashboard()', '    async function loadEventos()', {
    document: { getElementById: id => elements[id] },
    SBQuery: class {
      eq(key, value) { this.house = value; return this }
      order() { return this }
      async get() { return { data: events.filter(e => !this.house || e.casa === this.house) } }
    },
    renderEventosTable(id, rows) { rendered = rows },
  })
  await context.loadDashboard()
  assert.equal(elements['stat-total'].textContent, 1)
  assert.equal(elements['stat-confirmados'].textContent, 1)
  assert.equal(elements['stat-rascunhos'].textContent, 0)
  assert.deepEqual(rendered, [events[0]])
  elements['dashboard-casa'].value = ''
  await context.loadDashboard()
  assert.equal(elements['stat-total'].textContent, 2)
  assert.deepEqual(rendered, events)
})

test('salvamento legado bloqueia clique duplo e reenvio após sucesso', async () => {
  let calls = 0
  let finish
  const context = eventosFunction('    let salvandoOS = false;', '    async function salvarOSInterno()', {
    salvarOSInterno: () => { calls++; return new Promise(resolve => { finish = resolve }) },
    showOSAlert() {},
  })
  const first = context.salvarOS()
  await context.salvarOS()
  assert.equal(calls, 1)
  finish(true)
  await first
  await context.salvarOS()
  assert.equal(calls, 1)
})
