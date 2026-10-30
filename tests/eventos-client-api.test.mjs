import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function api(fetch) {
  const exports = {}
  const source = ts.transpileModule(fs.readFileSync('src/components/eventos/client-api.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(source, { exports, fetch, TypeError, Error })
  return exports.eventApi
}

test('consulta se recupera de Failed to fetch e de conexão interrompida na resposta', async () => {
  for (const failBody of [false, true]) {
    let calls = 0
    const request = api(async () => {
      calls++
      if (calls === 1) {
        if (failBody) return { ok: true, json: async () => { throw new TypeError('Failed to fetch') } }
        throw new TypeError('Failed to fetch')
      }
      return Response.json([{ id: 42 }])
    })
    assert.equal((await request('?id=eq.42'))[0].id, 42)
    assert.equal(calls, 2)
  }
})

test('escritas não são repetidas automaticamente após falha de rede', async () => {
  for (const method of ['POST', 'PATCH', 'DELETE']) {
    let calls = 0
    const request = api(async () => { calls++; throw new TypeError('Failed to fetch') })
    await assert.rejects(request('?id=eq.42', method), /conferir se a alteração foi salva/)
    assert.equal(calls, 1)
  }
})

test('falhas persistentes de rede e sessão expirada têm mensagem clara', async () => {
  let calls = 0
  await assert.rejects(api(async () => { calls++; throw new TypeError('Failed to fetch') })(), /conexão foi interrompida/)
  assert.equal(calls, 2)
  calls = 0
  await assert.rejects(api(async () => { calls++; return Response.json({ message: 'Sessão expirada.' }, { status: 401 }) })(), /Sessão expirada/)
  assert.equal(calls, 1)
})
