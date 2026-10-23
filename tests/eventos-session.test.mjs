import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function route(name, { role = 'admin', key = 'private-key', upstreamStatus = 200 } = {}) {
  const calls = []
  const source = fs.readFileSync(new URL(`../src/app/api/eventos/${name}/route.ts`, import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  vm.runInNewContext(code, {
    exports, Request, Response, URL,
    process: { env: { EVENTOS_SUPABASE_SERVICE_ROLE_KEY: key } },
    require: () => ({ getMiseSession: async () => role ? { employeeId: 'employee-1', employeeName: 'Pessoa do MISE', role } : null }),
    fetch: async (url, options) => { calls.push({ url, options }); return Response.json([{ id: 1, nome_evento: 'Evento' }], { status: upstreamStatus }) },
  })
  return { route: exports, calls }
}
const request = (method = 'GET', query = '', body, headers = {}) => new Request(`https://mise.example/api/eventos/data${query}`, {
  method, headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body),
})

test('sessão usa identidade e nível do MISE sem conta ou token de Eventos', async () => {
  for (const [role, expected] of [['admin', 'admin'], ['gerente', 'comercial'], ['cozinheiro', 'operacional']]) {
    const { route: api } = route('session', { role })
    const response = await api.GET()
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.deepEqual(await response.json(), { id: 'employee-1', nome: 'Pessoa do MISE', nivel_acesso: expected })
  }
})

test('sessão ausente e configuração ausente retornam erros claros', async () => {
  for (const name of ['session', 'data']) {
    assert.equal((await route(name, { role: null }).route.GET(request())).status, 401)
    assert.equal((await route(name, { key: '' }).route.GET(request())).status, 503)
  }
})

test('matriz de permissões é aplicada no servidor, sem confiar no navegador', async () => {
  for (const role of [null, 'admin', 'gerente', 'cozinheiro']) {
    for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
      const { route: api, calls } = route('data', { role })
      const body = ['POST', 'PATCH'].includes(method) ? { nome_evento: 'Evento' } : undefined
      const response = await api[method](request(method, '?id=eq.1', body))
      const allowed = role && (method === 'GET' || role === 'admin' || (role === 'gerente' && method !== 'DELETE'))
      assert.equal(response.status, allowed ? 200 : role ? 403 : 401, `${role} ${method}`)
      assert.equal(calls.length, allowed ? 1 : 0)
    }
  }
})

test('proxy permite somente filtros restritos e exige ID em alterações e exclusões', async () => {
  const { route: api, calls } = route('data')
  for (const query of ['?table=usuarios', '?id=gt.0', '?id=eq.1&id=eq.2', '?select=*,usuarios(*)', '?order=senha.asc']) {
    assert.equal((await api.GET(request('GET', query))).status, 400)
  }
  assert.equal((await api.PATCH(request('PATCH', '', { status: 'pago' }))).status, 400)
  assert.equal((await api.DELETE(request('DELETE'))).status, 400)
  assert.equal(calls.length, 0)
  await api.GET(request('GET', '?casa=eq.Fr%C3%AAneze&order=data_inicio.desc'))
  assert.equal(new URL(calls[0].url).pathname, '/rest/v1/eventos')
  assert.equal(new URL(calls[0].url).searchParams.get('casa'), 'eq.Frêneze')
})

test('autoria vem da sessão e campos de identidade não podem ser sobrescritos', async () => {
  const { route: api, calls } = route('data')
  await api.POST(request('POST', '', { nome_evento: 'Evento', criado_por: 'Outra pessoa', id: 99, nivel_acesso: 'master' }))
  const created = JSON.parse(calls[0].options.body)
  assert.equal(created.criado_por, 'Pessoa do MISE')
  assert.equal(created.id, undefined)
  assert.equal(created.nivel_acesso, undefined)
  await api.PATCH(request('PATCH', '?id=eq.1', { status: 'pago', criado_por: 'Outra pessoa' }))
  assert.equal(JSON.parse(calls[1].options.body).criado_por, undefined)
})

test('escritas de outra origem são bloqueadas e chave fica somente no servidor', async () => {
  const { route: api, calls } = route('data')
  assert.equal((await api.POST(request('POST', '', { nome_evento: 'Evento' }, { Origin: 'https://other.example' }))).status, 403)
  assert.equal(calls.length, 0)
  const response = await api.GET(request())
  assert.equal(calls[0].options.headers.apikey, 'private-key')
  assert.ok(!(await response.text()).includes('private-key'))
})

test('HTML entra automaticamente com MISE e não pede credenciais de Eventos', async () => {
  const html = fs.readFileSync(new URL('../eventos/index.html', import.meta.url), 'utf8')
  assert.ok(!html.includes('grant_type=password'))
  assert.ok(!html.includes('id="login-senha"'))
  assert.ok(!html.includes('supabase.co'))
  const elements = Object.fromEntries(['btn-entrar', 'login-error', 'session-status', 'screen-login', 'screen-app'].map(id => [id, { style: {} }]))
  let shownPage
  const context = vm.createContext({
    document: { getElementById: id => elements[id] },
    fetch: async url => { assert.equal(url, '/api/eventos/session'); return Response.json({ nome: 'Pessoa', nivel_acesso: 'comercial' }) },
    setupUI() {}, showPage(page) { shownPage = page },
  })
  vm.runInContext(html.slice(html.indexOf('    function mostrarErroSessao'), html.indexOf('    function setupUI')), context)
  await context.checkSession()
  assert.equal(shownPage, 'dashboard')
  assert.equal(elements['screen-login'].style.display, 'none')
  assert.equal(elements['screen-app'].style.display, 'block')
  context.fetch = async () => Response.json({ message: 'Sessão expirada' }, { status: 401 })
  await context.checkSession()
  assert.equal(elements['screen-app'].style.display, 'none')
  assert.equal(elements['login-error'].textContent, 'Sessão expirada')
})
