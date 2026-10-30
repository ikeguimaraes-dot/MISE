import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const exports = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/eventos/model.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports })

test('valores em reais preservam centavos, zero e não informado', () => {
  for (const [input, expected] of [['', null], ['   ', null], ['0', 0], ['0,00', 0], ['1.250,50', 1250.5], ['1250.50', 1250.5], ['R$ 1.250,50', 1250.5], ['9999999999,99', 9999999999.99]]) assert.equal(exports.parseMoney(input), expected)
  for (const input of ['-1', 'abc', '1,234', '1.000', '1.2.3', 'Infinity', '1e3', '10000000000']) assert.throws(() => exports.parseMoney(input))
  assert.equal(exports.money(null), 'Não informado')
  assert.match(exports.money(0), /0,00/)
})

test('dados operacionais e anexos legados podem ser lidos como JSON ou arrays', () => {
  const data = [{ servico: '_info', descritivo: 'Informações antigas' }]
  assert.equal(JSON.stringify(exports.rows(JSON.stringify(data))), JSON.stringify(data))
  assert.equal(exports.rows(data), data)
  assert.equal(exports.rows(null).length, 0)
})

test('total soma A&B e locação em centavos, distinguindo ausência de zero', () => {
  assert.equal(exports.eventTotal(1250.5, 2500.75), 3751.25)
  assert.equal(exports.eventTotal(0.1, 0.2), 0.3)
  assert.equal(exports.eventTotal(null, null), null)
  assert.equal(exports.eventTotal('', undefined), null)
  assert.equal(exports.eventTotal(0, null), 0)
  assert.equal(exports.eventTotal(null, 150), 150)
  assert.equal(exports.eventTotal(150, null), 150)
  assert.equal(exports.eventTotal('1250.50', '2500.75'), 3751.25)
})


test('salvar edição nunca recorre a criação se o ID estiver ausente', () => {
  for (const id of [null, undefined, 0, -1, NaN]) assert.throws(() => exports.eventSaveRequest({ kind: 'edit', id }, { nome_evento: 'Evento' }))
  const request = exports.eventSaveRequest({ kind: 'edit', id: 42 }, { id: 42, nome_evento: 'Evento editado' })
  assert.equal(request.method, 'PATCH')
  assert.equal(request.query, '?id=eq.42')
  assert.throws(() => exports.eventSaveRequest({ kind: 'edit', id: 42 }, { id: 43 }))
  assert.throws(() => exports.eventSaveRequest({ kind: 'create' }, { id: 42 }))
  assert.equal(exports.eventSaveRequest({ kind: 'create' }, { nome_evento: 'Novo evento' }).method, 'POST')
})

test('salvamentos operacional e financeiro não carregam campos um do outro', () => {
  const event = { id: 42, versao: 3, nome_evento: 'OS', status: 'confirmado', custo_evento: '1.250,50', valor_cobrado: '2.000,00', situacao_pagamento: 'Via Financeiro Adm', pagamento_status: 'Pago', pagamento_meio: 'Pix', comprovantes_pagamento: '[]' }
  const operational = exports.operationalPayload(event)
  assert.equal(operational.id, 42)
  assert.equal(operational.versao, 3)
  for (const key of exports.financialFields) assert.equal(Object.hasOwn(operational, key), false)
  const financial = exports.financialPayload(event)
  assert.equal(financial.custo_evento, 1250.5)
  assert.equal(financial.pagamento_status, 'Pago')
  for (const key of ['id', 'versao', 'nome_evento', 'status']) assert.equal(Object.hasOwn(financial, key), false)
})

test('valor parcial pertence somente ao salvamento financeiro e aceita formato brasileiro', () => {
  const event = { id: 42, versao: 3, pagamento_status: 'Pagamento parcial', valor_pago_parcial: '1.250,50' }
  assert.equal(exports.financialPayload(event).valor_pago_parcial, 1250.5)
  assert.equal(Object.hasOwn(exports.operationalPayload(event), 'valor_pago_parcial'), false)
})

test('extras somam ao total e são salvos somente no financeiro', () => {
  assert.equal(exports.eventTotal(0.1, 0.2, 0.3), 0.6)
  assert.equal(exports.eventTotal(null, null, 50), 50)
  const draft = { extras_valor: '1.250,50', extras_valor_pago: '250,25', extras_status: 'Pagamento parcial', extras_meio: 'Pix', extras_local: 'Via Financeiro Adm' }
  assert.equal(exports.financialPayload(draft).extras_valor, 1250.5)
  assert.equal(exports.financialPayload(draft).extras_valor_pago, 250.25)
  assert.equal(Object.keys(exports.operationalPayload(draft)).length, 0)
})

test('dados do evento exigem preenchimento completo e tema continua opcional', () => {
  const event = { nome_evento: 'Evento', tipo_evento: 'Jantar', data_inicio: '2026-11-01', hora_inicio: '18:00', hora_termino: '23:00', num_convidados: '40', contato: 'Reservas', responsavel_comercial: 'Comercial', responsavel_operacional: 'Operação', briefing_cliente: 'Descrição do evento' }
  assert.equal(exports.eventDetailsError(event), null)
  assert.equal(exports.eventDetailsError({ ...event, tema: '' }), null)
  for (const [key] of exports.requiredEventFields) {
    assert.ok(exports.eventDetailsError({ ...event, [key]: '   ' }), key)
    const incomplete = { ...event }; delete incomplete[key]
    assert.ok(exports.eventDetailsError(incomplete), key)
  }
  assert.equal(exports.eventDetailsError({ ...event, num_convidados: '0' }), null)
})
