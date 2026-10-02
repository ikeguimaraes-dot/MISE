import assert from 'node:assert/strict'
import test from 'node:test'
import { actionsFor, money, parseMoney, samples, transition, upgradePreview } from '../src/components/extras-evaluation/model.ts'

const fixtures = () => samples('2026-10-02')
test('normal flow requires each role and Finance confirmation after receipt', () => {
  let item = fixtures()[0]
  assert.throws(() => transition(item, 'Caixa', 'informar', { receipt: true }))
  item = transition(item, 'RH', 'preparar_rh', { name: 'Exemplo', value: 15000, commission: 3050, payer: 'Casa', identityChecked: true })
  assert.throws(() => transition(item, 'Caixa', 'informar', { receipt: true }))
  assert.equal(item.status, 'aguardando_diretor')
  assert.throws(() => transition(item, 'Financeiro', 'reservar'))
  assert.throws(() => transition(item, 'RH', 'aprovar_operacao', {}, 'Sem alçada'))
  item = transition(item, 'Diretor de Operação', 'aprovar_operacao', {}, 'Cobertura aprovada')
  item = transition(item, 'Financeiro', 'reservar')
  assert.throws(() => transition(item, 'Caixa', 'informar'))
  item = transition(item, 'Caixa', 'informar', { receipt: true })
  assert.equal(item.status, 'informado')
  assert.throws(() => transition(item, 'Caixa', 'conferir'))
  assert.throws(() => transition(item, 'Caixa', 'informar', { receipt: true }))
  item = transition(item, 'Financeiro', 'conferir')
  assert.equal(item.status, 'pago')
  assert.equal(item.history.length, 6)
  assert.equal(money(item.value + item.commission), 'R$\u00a0180,50')
  for (const role of ['Líder', 'RH', 'Financeiro', 'Caixa', 'Diretor de Operação']) assert.deepEqual(actionsFor(item, role), [])
})
test('emergency needs PRIOR approval, then RH regularization and Finance confirmation', () => {
  let item = fixtures()[4]
  assert.deepEqual(actionsFor(item, 'Caixa'), ['cancelar'])
  assert.throws(() => transition(item, 'Caixa', 'informar', { receipt: true }))
  assert.throws(() => transition(item, 'Diretor de Operação', 'aprovar_emergencia'))
  item = transition(item, 'Diretor de Operação', 'aprovar_emergencia', {}, 'Cobertura aprovada previamente')
  item = transition(item, 'Caixa', 'informar', { receipt: true })
  assert.throws(() => transition(item, 'Financeiro', 'conferir'))
  assert.throws(() => transition(item, 'RH', 'regularizar', { name: item.name, value: 99999, commission: 0, identityChecked: true, payer: 'Casa' }))
  item = transition(item, 'RH', 'regularizar', { name: item.name, value: item.value, commission: item.commission, identityChecked: true, payer: 'Casa' })
  item = transition(item, 'Financeiro', 'conferir')
  assert.equal(item.status, 'pago')
  assert.equal(item.emergency, true)
  assert.equal(item.history[1].actor, 'Diretor de Operação')
})
test('Estaff does not enter the cashier payment path', () => {
  let item = transition(fixtures()[5], 'Financeiro', 'reservar')
  assert.deepEqual(actionsFor(item, 'Caixa'), [])
  item = transition(item, 'Financeiro', 'informar', { receipt: true })
  item = transition(item, 'Financeiro', 'conferir')
  assert.equal(item.status, 'pago')
})
test('invalid values and missing identity cannot pass RH', () => {
  const item = fixtures()[0]
  for (const value of [NaN, -1, 0, Infinity, 150.5]) assert.throws(() => transition(item, 'RH', 'preparar_rh', { name: 'Exemplo', value, commission: 0, payer: 'Casa', identityChecked: true }))
  assert.throws(() => transition(item, 'RH', 'preparar_rh', { name: 'Exemplo', value: 15000, commission: 0, payer: 'Casa', identityChecked: false }))
})
test('cancellation and refusal require a reason and preserve the audit trail', () => {
  const item = fixtures()[0]
  assert.throws(() => transition(item, 'Líder', 'cancelar'))
  const cancelled = transition(item, 'Líder', 'cancelar', {}, 'Cobertura resolvida')
  assert.equal(cancelled.status, 'cancelado')
  assert.equal(cancelled.history.length, 2)
  assert.equal(item.history.length, 1)
  assert.deepEqual(actionsFor(cancelled, 'RH'), [])
})
test('Brazilian currency parsing keeps cents and rejects malformed numbers', () => {
  assert.equal(parseMoney('150,50'), 15050)
  assert.equal(parseMoney('1.234,56'), 123456)
  assert.equal(parseMoney('R$ 150,00'), 15000)
  for (const invalid of ['-1,00', '1e3', '150.50', '1,234', '', 'abc']) assert.ok(Number.isNaN(parseMoney(invalid)))
})

test('director can refuse a normal request but requires a recorded reason', () => {
  const item = fixtures()[1]
  assert.throws(() => transition(item, 'Diretor de Operação', 'aprovar_operacao'))
  assert.throws(() => transition(item, 'Diretor de Operação', 'recusar'))
  const refused = transition(item, 'Diretor de Operação', 'recusar', {}, 'Cobertura interna disponível')
  assert.equal(refused.status, 'recusado')
  assert.deepEqual(actionsFor(refused, 'Financeiro'), [])
})

test('v1 local records survive migration without inventing director approval', () => {
  const originals = [fixtures()[0], { ...fixtures()[1], status: 'aprovado_rh' }, fixtures()[2], fixtures()[3]]
  const upgraded = upgradePreview(originals, 1)
  assert.equal(upgraded.length, originals.length)
  assert.equal(upgraded[0].id, originals[0].id)
  assert.equal(upgraded[0].status, 'solicitado')
  assert.equal(upgraded[1].status, 'aguardando_diretor')
  assert.equal(upgraded[2].status, 'aguardando_diretor')
  assert.equal(upgraded[3].status, 'informado')
  assert.equal(upgraded[1].history.at(-1).actor, 'Sistema')
  assert.deepEqual(upgradePreview(upgraded, 2), upgraded)
})
