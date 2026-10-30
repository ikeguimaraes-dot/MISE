import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const filename = '11111111-1111-4111-8111-111111111111--contrato.pdf'
function api({ role = 'admin', exists = true } = {}) {
  const calls = []
  const storage = {
    list: async prefix => { calls.push(['list', prefix]); return { data: [{ id: 'file', name: filename, metadata: { size: 100 } }], error: null } },
    upload: async (path, bytes, options) => { calls.push(['upload', path, bytes, options]); return { error: null } },
    createSignedUrl: async (path, seconds) => { calls.push(['sign', path, seconds]); return { data: { signedUrl: 'https://storage.example/signed-contract' }, error: null } },
  }
  const client = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: exists ? { id: 42 } : null, error: null }) }) }) }),
    storage: { from: bucket => { assert.equal(bucket, 'mise-eventos-documentos'); return storage } },
  }
  const source = fs.readFileSync('src/app/api/eventos/documento/route.ts', 'utf8')
  const exports = {}
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Request, Response, File, URL, Uint8Array,
    process: { env: { EVENTOS_SUPABASE_SERVICE_ROLE_KEY: 'private-test-key' } },
    require: name => name === 'node:crypto' ? { randomUUID: () => filename.slice(0, 36) } : name === '@supabase/supabase-js' ? { createClient: () => client } : { getMiseSession: async () => role ? { role } : null },
  })
  return { route: exports, calls }
}
function upload(file = new File(['%PDF-1.7\nTest'], 'contrato.pdf', { type: 'application/pdf' }), origin) {
  const body = new FormData(); body.set('file', file)
  return new Request('https://mise.example/api/eventos/documento?id=42', { method: 'POST', body, headers: origin ? { Origin: origin } : {} })
}
const read = query => new Request(`https://mise.example/api/eventos/documento?${query}`)

test('contratos exigem sessão e OS existente; operação apenas consulta', async () => {
  assert.equal((await api({ role: null }).route.GET(read('id=42'))).status, 401)
  assert.equal((await api({ role: 'cozinheiro' }).route.POST(upload())).status, 403)
  const missing = api({ exists: false })
  assert.equal((await missing.route.POST(upload())).status, 404)
  assert.equal(missing.calls.length, 0)
  assert.equal((await api({ role: 'cozinheiro' }).route.GET(read('id=42'))).status, 200)
})

test('upload salva arquivo privado na pasta da OS e não sobrescreve contrato anterior', async () => {
  const { route, calls } = api()
  const result = await route.POST(upload())
  assert.equal(result.status, 201)
  assert.equal((await result.json()).key, filename)
  assert.equal(calls[0][0], 'upload')
  assert.equal(calls[0][1], `42/${filename}`)
  assert.equal(calls[0][3].upsert, false)
  assert.equal(calls[0][3].contentType, 'application/pdf')
})

test('upload rejeita origem externa, arquivo disfarçado e tamanho excessivo', async () => {
  const { route, calls } = api()
  assert.equal((await route.POST(upload(undefined, 'https://other.example'))).status, 403)
  assert.equal((await route.POST(upload(new File(['<html>'], 'contrato.pdf', { type: 'application/pdf' })))).status, 400)
  assert.equal((await route.POST(upload(new File([new Uint8Array(3 * 1024 * 1024 + 1)], 'contrato.pdf', { type: 'application/pdf' })))).status, 413)
  assert.equal(calls.length, 0)
})

test('consulta lista contratos e abertura usa link curto assinado somente da própria OS', async () => {
  const { route, calls } = api()
  const list = await route.GET(read('id=42'))
  assert.equal((await list.json())[0].name, 'contrato.pdf')
  assert.equal(list.headers.get('cache-control'), 'private, no-store')
  const view = await route.GET(read(`id=42&file=${filename}`))
  assert.equal(view.status, 302)
  assert.equal(view.headers.get('location'), 'https://storage.example/signed-contract')
  assert.deepEqual(calls[1], ['sign', `42/${filename}`, 60])
  assert.equal((await route.GET(read('id=42&file=../43/contrato.pdf'))).status, 400)
})
