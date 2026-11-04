import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const model = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/extras/positions.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: model })
const request = { mise_managed: true, status: 'recusado', mise_requested_by: 'owner', mise_named_at: null, emergencial: false }

test('recusado permite uma correção ao autor e uma reconsideração à diretoria', () => {
  assert.equal(model.positionActions(request, 'lider', 'owner').join(), 'reenviar_recusada')
  assert.equal(model.positionActions(request, 'diretor', 'director').join(), 'reconsiderar_recusa')
  assert.equal(model.positionActions({ ...request, mise_refusal_edited: true }, 'lider', 'owner').length, 0)
  assert.equal(model.positionActions({ ...request, mise_refusal_reconsidered: true }, 'diretor', 'director').length, 0)
  assert.equal(model.positionActions({ ...request, mise_refusal_edited: true }, 'diretor', 'director').join(), 'reconsiderar_recusa')
})

test('RH, Caixa, terceiros, cancelados, emergências e pedidos com pessoas não ganham edição', () => {
  for (const role of ['rh', 'caixa', 'financeiro']) assert.equal(model.positionActions(request, role, 'owner').length, 0)
  assert.equal(model.positionActions(request, 'lider', 'another').length, 0)
  assert.equal(model.positionActions({ ...request, mise_named_at: '2026-11-04T00:00:00Z' }, 'lider', 'owner').length, 0)
  for (const change of [{ status: 'cancelado' }, { mise_managed: false }, { emergencial: true }]) {
    assert.equal(model.positionActions({ ...request, ...change }, 'lider', 'owner').length, 0)
    assert.equal(model.positionActions({ ...request, ...change }, 'diretor', 'director').length, 0)
  }
})
