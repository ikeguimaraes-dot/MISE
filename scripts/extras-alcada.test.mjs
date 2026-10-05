import assert from 'node:assert/strict'
import test from 'node:test'
import { calcWeeklyBudget, requestRoute, weekDays, usageLevel, extraAlerts, validDate } from '../src/lib/extras/alcada.ts'
import { samples, transition, actionsFor } from '../src/components/extras-evaluation/model.ts'
const id = 'meet'
const source = () => ({ metas: Array.from({ length: 7 }, (_, dia_semana) => ({ unit_id: id, competencia: '2026-09', dia_semana, meta: dia_semana === 0 ? 80000 : 70000 })), overrides: [], configs: [{ unit_id: id, percentual: '1.0', vigente_desde: '2026-09-01' }], extras: [] })
const budget = (data = source(), ref = '2026-09-09') => calcWeeklyBudget(id, ref, data)

test('Monday–Sunday, Sunday boundary, year boundary and invalid dates', () => {
  assert.deepEqual(weekDays('2026-10-04'), ['2026-09-28','2026-09-29','2026-09-30','2026-10-01','2026-10-02','2026-10-03','2026-10-04'])
  assert.equal(weekDays('2026-10-05')[0], '2026-10-05')
  assert.equal(weekDays('2027-01-01')[0], '2026-12-28')
  assert.equal(validDate('2026-02-30'), false)
  assert.throws(() => weekDays('bad'))
})
test('R$500,000 revenue target gives R$5,000 allowance in cents', () => {
  const b = budget()
  assert.equal(b.metaSemana, 50000000)
  assert.equal(b.teto, 500000)
  assert.equal(b.saldo, 500000)
})
test('daily competence across months, date override including zero, missing days', () => {
  const data = source()
  data.metas.push(...Array.from({ length: 7 }, (_, dia_semana) => ({ unit_id: id, competencia: '2026-10', dia_semana, meta: 100000 })))
  data.overrides.push({ unit_id: id, data: '2026-10-01', meta: 0 })
  const b = budget(data, '2026-10-02')
  assert.equal(b.metaSemana, (70000 * 3 + 100000 * 3) * 100)
  assert.deepEqual(b.diasSemMeta, [])
  data.metas = data.metas.filter(row => row.competencia !== '2026-10')
  const missing = budget(data, '2026-10-02')
  assert.deepEqual(missing.diasSemMeta, ['2026-10-02','2026-10-03','2026-10-04'])
  assert.equal(missing.teto, 210000)
  assert.match(missing.avisos[0], /3 dia/)
})
test('versioned percentage uses work date, no future or hardcoded fallback, zero is valid', () => {
  const data = source()
  data.configs.push({ unit_id: id, percentual: '1.5', vigente_desde: '2026-09-10' })
  assert.equal(budget(data, '2026-09-09').teto, 500000)
  assert.equal(budget(data, '2026-09-10').teto, 750000)
  const missing = budget({ ...data, configs: [] })
  assert.equal(missing.teto, 0)
  assert.equal(missing.percentual, null)
  assert.match(missing.avisos[0], /Percentual/)
  assert.equal(budget({ ...data, configs: [{ unit_id: id, percentual: 0, vigente_desde: '2026-01-01' }] }).percentual, 0)
  data.configs.push({ unit_id: id, percentual: 2, vigente_desde: '2026-09-10' })
  assert.throws(() => budget(data, '2026-09-10'), /mesma vigência/)
})
test('consumption includes pending, paid and emergency; excludes cancelled, refused, other unit/week', () => {
  const data = source()
  data.extras = ['solicitado','aguardando_diretoria','aprovado_rh','reservado_financeiro','pago','recusado','cancelado'].map(status => ({ unit_id: id, data_trabalho: '2026-09-09', total: '100.01', status }))
  data.extras.push({ unit_id: 'other', data_trabalho: '2026-09-09', total: 1000, status: 'pago' }, { unit_id: id, data_trabalho: '2026-09-14', total: 1000, status: 'pago' })
  assert.equal(budget(data).gasto, 50005)
  assert.equal(budget(data, '2026-09-14').gasto, 100000)
  assert.equal(budget(data, '2026-09-14').teto, 500000)
})
test('exact balance follows RH, one cent over needs director, emergency always registers', () => {
  const b = { ...budget(), gasto: 324000, saldo: 176000 }
  assert.equal(requestRoute(b, 176000, false).status, 'solicitado')
  assert.deepEqual(requestRoute(b, 176001, false), { status: 'aguardando_diretoria', excesso: 1, alertarDiretoria: false })
  assert.deepEqual(requestRoute(b, 218000, false), { status: 'aguardando_diretoria', excesso: 42000, alertarDiretoria: false })
  assert.equal(requestRoute(b, 900000, true).alertarDiretoria, true)
  assert.equal(requestRoute(b, 900000, true).status, 'solicitado')
  for (const value of [0, -1, NaN, Infinity, 0.1]) assert.throws(() => requestRoute(b, value, false))
})
test('no target does not block registration; zero ceiling shows no infinity/NaN', () => {
  const b = budget({ metas: [], configs: [], overrides: [], extras: [] })
  assert.equal(b.diasSemMeta.length, 7)
  assert.equal(requestRoute(b, 15000, false).status, 'aguardando_diretoria')
  assert.equal(usageLevel({ teto: 0, gasto: 0 }).percentage, 0)
  assert.deepEqual(usageLevel({ teto: 0, gasto: 1 }), { percentage: null, width: 100, tone: 'critical' })
})
test('amber strictly above 80%; red strictly above 100%', () => {
  assert.equal(usageLevel({ teto: 10000, gasto: 8000 }).tone, 'normal')
  assert.equal(usageLevel({ teto: 10000, gasto: 8001 }).tone, 'warning')
  assert.equal(usageLevel({ teto: 10000, gasto: 10000 }).tone, 'warning')
  assert.equal(usageLevel({ teto: 10000, gasto: 10001 }).tone, 'critical')
})
test('alerts: exhausted weekly allowance, strictly over 24h, old work date, immediate emergency', () => {
  const units = [{ id, name: 'Meet', budget: { ...budget(), gasto: 500001, saldo: -1 } }]
  const now = new Date('2026-10-05T15:00:00Z')
  const base = { id: 'old', unit_id: id, data_trabalho: '2026-09-01', status: 'aguardando_diretoria', created_at: '2026-10-04T14:59:59Z', emergencial: false }
  const alerts = extraAlerts(units, [base, { ...base, id: 'exact24h', created_at: '2026-10-04T15:00:00Z' }, { ...base, id: 'urgent', status: 'solicitado', emergencial: true, created_at: now.toISOString() }, { ...base, id: 'paid', status: 'pago', emergencial: true }], now)
  assert.equal(alerts.length, 3)
  assert.equal(alerts[0].severidade, 'atencao')
  assert.equal(alerts[1].severidade, 'critico')
  assert.match(alerts[1].href, /2026-09-01/)
  assert.equal(alerts[2].id, 'extras-emergencia-urgent')
})
const rh = item => ({ name: 'Exemplo', value: item.value, commission: item.commission, payer: 'Casa', identityChecked: true })
test('within allowance RH goes to Finance, no director step', () => {
  let item = samples('2026-09-09', true)[0]
  item = transition(item, 'RH', 'preparar_rh', rh(item), '', undefined, budget())
  assert.equal(item.status, 'aprovado_rh')
  assert.deepEqual(actionsFor(item, 'Diretor de Operação'), [])
  item = transition(item, 'Financeiro', 'reservar')
  item = transition(item, 'Caixa', 'informar', { receipt: true })
  item = transition(item, 'Financeiro', 'conferir')
  assert.equal(item.status, 'pago')
})
test('over budget director approves BEFORE RH and approval is amount-bound', () => {
  let item = samples('2026-09-09', true)[1]
  assert.equal(item.rhComplete, false)
  assert.throws(() => transition(item, 'RH', 'preparar_rh', rh(item), '', undefined, budget()))
  assert.throws(() => transition(item, 'Líder', 'aprovar_operacao', {}, 'a'))
  item = transition(item, 'Diretor de Operação', 'aprovar_operacao', {}, 'Aprovo cobertura')
  assert.equal(item.status, 'solicitado')
  const higher = transition(item, 'RH', 'preparar_rh', { ...rh(item), value: item.value + 1 }, '', undefined, budget())
  assert.equal(higher.status, 'aguardando_diretoria')
  item = transition(item, 'RH', 'preparar_rh', rh(item), '', undefined, budget())
  assert.equal(item.status, 'aprovado_rh')
})
test('RH increase crossing allowance routes back to director and excludes original self from budget', () => {
  let item = samples('2026-09-09', true)[0]
  const b = { ...budget(), gasto: 490000, saldo: 10000 }
  item = transition(item, 'RH', 'preparar_rh', rh(item), '', undefined, b)
  assert.equal(item.status, 'aguardando_diretoria')
  assert.equal(item.excess, 5000)
  assert.throws(() => transition(samples('2026-09-09', true)[0], 'RH', 'preparar_rh', rh(item)))
})
test('new emergency exception permits payment, preserves receipt and later RH/Finance checks', () => {
  let item = samples('2026-09-09', true)[4]
  assert.ok(actionsFor(item, 'Caixa').includes('informar'))
  assert.throws(() => transition(item, 'Caixa', 'informar'))
  item = transition(item, 'Caixa', 'informar', { receipt: true })
  assert.throws(() => transition(item, 'Financeiro', 'conferir'))
  assert.throws(() => transition(item, 'RH', 'regularizar', { ...rh(item), value: item.value + 1 }))
  item = transition(item, 'RH', 'regularizar', rh(item))
  item = transition(item, 'Financeiro', 'conferir')
  assert.equal(item.status, 'pago')
  assert.equal(item.emergencyApproved, false)
})
