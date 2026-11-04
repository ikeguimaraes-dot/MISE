// Isolated PostgreSQL fixture only. Does not connect to Supabase/production.
import { execFileSync, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
const args = ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-h', process.env.EXTRAS_TEST_SOCKET || '/tmp/mise-postgres-extras-crivo-20261005', '-p', process.env.EXTRAS_TEST_PORT || '55447', '-d', process.env.EXTRAS_TEST_DB || 'postgres']
const quote = value => `'${String(value).replaceAll("'", "''")}'`
const sql = query => execFileSync('psql', [...args, '-c', query], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const reject = (call, message) => assert.throws(call, undefined, message)
const unit = randomUUID(), roleId = randomUUID(), job = randomUUID(), requester = randomUUID()
const actors = Object.fromEntries(['lider', 'other', 'rh', 'diretor', 'caixa'].map(role => [role, randomUUID()]))
sql(`INSERT INTO units(id,name) VALUES(${quote(unit)},'Synthetic refusal'); INSERT INTO roles VALUES(${quote(roleId)},'Founder','["*"]'); INSERT INTO op_extra_alcada VALUES(${quote(unit)},1,'2026-01-01'); INSERT INTO metas_dia_semana(unit_id,dia_semana,meta,competencia) SELECT ${quote(unit)},d,10000,'2026-10' FROM generate_series(0,6)d; INSERT INTO op_extra_cargo(id,nome,setor_padrao,valor_referencia) VALUES(${quote(job)},${quote('Synthetic refusal '+job)},'Synthetic',150); INSERT INTO op_extra_solicitante(id,unit_id,nome) VALUES(${quote(requester)},${quote(unit)},'Declared manager');`)
for (const [role, id] of Object.entries(actors)) sql(`INSERT INTO auth.users VALUES(${quote(id)}); INSERT INTO employees(id,unit_id,user_id,role_id) VALUES(${quote(id)},${quote(unit)},${quote(id)},${quote(roleId)}); INSERT INTO mise.extra_access(employee_id,unit_id,role,granted_by) VALUES(${quote(id)},${quote(unit)},${quote(role === 'other' ? 'lider' : role)},${quote(actors.lider)});`)
const data = (value = 800, extra = {}) => ({ unit_id: unit, solicitante_cadastro_id: requester, cargo_id: job, quantidade: 1, valor_unitario: value, data_trabalho: '2026-10-05', periodo: 'almoco', motivo: 'evento', note: 'Synthetic correction reason', ...extra })
const command = (actor, action, id, version, payload = {}, key = randomUUID()) => `SELECT mise.extra_request_command(${quote(actors[actor])},${quote(actor === 'other' ? 'lider' : actor)},${quote(key)},${quote(action)},${quote(id)},${version},${quote(JSON.stringify(payload))}::jsonb)`
const call = (...args) => JSON.parse(sql(command(...args)))
const row = id => JSON.parse(sql(`SELECT row_to_json(r) FROM mise.extra_request_summary r WHERE id=${quote(id)}`))
const budget = day => JSON.parse(sql(`SELECT mise.extra_week_budget(${quote(unit)},${quote(day)})`))
const refused = () => { const id = randomUUID(); call('lider', 'solicitar', id, 0, data()); call('diretor', 'recusar', id, 1, { note: 'Not approved' }); return id }

const id = refused()
assert.equal(budget('2026-10-05').usado, 0)
reject(() => call('other', 'reenviar_recusada', id, 2, data(100)), 'other requester denied')
reject(() => call('rh', 'reenviar_recusada', id, 2, data(100)), 'RH cannot rewrite request')
reject(() => call('lider', 'reenviar_recusada', id, 2, data(100, { note: '' })), 'reason is mandatory')
reject(() => call('lider', 'reenviar_recusada', id, 2, data(100, { quantidade: 0 })), 'invalid quantity rejected')
assert.equal(row(id).mise_refusal_edited, false)
const key = randomUUID(), edited = data(100, { data_trabalho: '2026-10-12', quantidade: 2 })
assert.equal(call('lider', 'reenviar_recusada', id, 2, edited, key).status, 'aguardando_diretoria')
assert.equal(call('lider', 'reenviar_recusada', id, 2, edited, key).replayed, true)
assert.equal(row(id).mise_version, 3)
assert.equal(row(id).mise_refusal_edited, true)
assert.equal(budget('2026-10-05').usado, 0)
assert.equal(budget('2026-10-12').usado, 200)
const changes = JSON.parse(sql(`SELECT changes FROM mise.extra_request_events WHERE request_id=${quote(id)} AND action='reenviar_recusada'`))
assert.equal(changes.before.valor_unitario, 800)
assert.equal(changes.after.valor_unitario, 100)
assert.equal(changes.after.data_trabalho, '2026-10-12')
reject(() => call('diretor', 'aprovar', id, 2, { note: 'stale' }), 'stale director decision denied')
call('diretor', 'recusar', id, 3, { note: 'Still refused' })
reject(() => call('lider', 'reenviar_recusada', id, 4, edited), 'second correction denied')
reject(() => call('lider', 'reconsiderar_recusa', id, 4, { note: 'not a director' }), 'requester cannot reconsider')
const approvalKey = randomUUID()
assert.equal(call('diretor', 'reconsiderar_recusa', id, 4, { note: 'Now approved' }, approvalKey).status, 'solicitado')
assert.equal(call('diretor', 'reconsiderar_recusa', id, 4, { note: 'Now approved' }, approvalKey).replayed, true)
assert.equal(row(id).mise_refusal_reconsidered, true)
assert.equal(budget('2026-10-12').usado, 200)
console.log('PASS edit/reconsider once, ownership, mandatory reason, stale version, retries, history snapshots, cross-week allowance')

// Reconsideration after RH has named a person restores that person without rebuilding identity.
const named = refused()
call('diretor', 'reconsiderar_recusa', named, 2, { note: 'First reconsideration' })
call('rh', 'nomear_rh', named, 3, { pagadora: 'casa', pessoas: [{ posicao: 1, nome: 'Synthetic person', cpf: '52998224725', valor: 900 }] })
assert.equal(row(named).status, 'aguardando_diretoria')
call('diretor', 'recusar', named, 4, { note: 'Increase refused' })
reject(() => call('diretor', 'reconsiderar_recusa', named, 5, { note: 'Second try' }), 'second reconsideration denied')
reject(() => call('lider', 'reenviar_recusada', named, 5, data()), 'cannot edit request with people')

const attached = randomUUID()
call('lider', 'solicitar', attached, 0, data())
call('diretor', 'aprovar', attached, 1, { note: 'Approved estimate' })
call('rh', 'nomear_rh', attached, 2, { pagadora: 'casa', pessoas: [{ posicao: 1, nome: 'Preserved person', cpf: '52998224725', valor: 950 }] })
call('diretor', 'recusar', attached, 3, { note: 'Increase refused' })
const personBefore = sql(`SELECT id FROM op_extra WHERE solicitacao_id=${quote(attached)}`)
assert.equal(call('diretor', 'reconsiderar_recusa', attached, 4, { note: 'Increase reconsidered' }).status, 'aprovado_rh')
assert.equal(sql(`SELECT id FROM op_extra WHERE solicitacao_id=${quote(attached)}`), personBefore)
assert.equal(sql(`SELECT status FROM op_extra WHERE solicitacao_id=${quote(attached)}`), 'aprovado_rh')
assert.equal(row(attached).preenchidos, 1)
assert.equal(row(attached).mise_approved_total, 950)
console.log('PASS director limit survives later refusals; named identity preserved when director reopens refused request')

const race = refused(), payload = data(50)
const concurrent = query => new Promise((resolve, reject) => { const p = spawn('psql', [...args, '-c', query]); let out = '', err = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d); p.on('exit', code => code ? reject(new Error(err)) : resolve(out)) })
const results = await Promise.allSettled([1, 2].map(() => concurrent(command('lider', 'reenviar_recusada', race, 2, payload))))
assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
assert.equal(sql(`SELECT count(*) FROM mise.extra_request_events WHERE request_id=${quote(race)} AND action='reenviar_recusada'`), '1')
console.log('PASS concurrent corrections produce one event and one allowance reservation')

const mixed = refused(), base = budget('2026-10-05').usado
const mixedResults = await Promise.allSettled([
  concurrent(command('lider', 'reenviar_recusada', mixed, 2, data(30))),
  concurrent(command('diretor', 'reconsiderar_recusa', mixed, 2, { note: 'Concurrent review' })),
])
assert.equal(mixedResults.filter(r => r.status === 'fulfilled').length, 1)
assert.equal(sql(`SELECT count(*) FROM mise.extra_request_events WHERE request_id=${quote(mixed)} AND action IN ('reenviar_recusada','reconsiderar_recusa')`), '1')
assert.equal(budget('2026-10-05').usado, base + row(mixed).valor_total)
const cancelled = randomUUID(); call('lider', 'solicitar', cancelled, 0, data(10)); call('lider', 'cancelar', cancelled, 1, { note: 'Cancelled' })
reject(() => call('lider', 'reenviar_recusada', cancelled, 2, data(5)), 'cancelled cannot reopen')
reject(() => call('diretor', 'reconsiderar_recusa', cancelled, 2, { note: 'Not a refusal' }), 'cancelled cannot be reconsidered')
console.log('PASS concurrent edit versus approval serializes, allowance matches winner, cancelled requests stay closed')
