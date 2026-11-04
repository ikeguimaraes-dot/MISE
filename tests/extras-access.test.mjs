import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const home = '10000000-0000-4000-8000-000000000001'
const other = '20000000-0000-4000-8000-000000000001'
const outside = '30000000-0000-4000-8000-000000000001'
function context(role, explicit = [], active = true) {
  const exports = {}
  const db = {
    schema: () => db,
    from: table => {
      const result = { data: table === 'employees' ? { ativo: active, unit_id: home } : table === 'extra_access' ? explicit : [{ unit_id: home }, { unit_id: other }], error: null }
      const query = { select: () => query, eq: () => query, single: async () => result, then: (resolve, reject) => Promise.resolve(result).then(resolve, reject) }
      return query
    },
  }
  const source = ts.transpileModule(fs.readFileSync('src/lib/extras/access.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(source, { exports, require: name => name === '@/lib/session' ? { getMiseSession: async () => ({ employeeId: 'actor', role }) } : name === '@/lib/supabase/server' ? { createServiceClient: () => db } : {} })
  return exports
}

test('administrador usa liderança em outra casa somente com atribuição explícita', async () => {
  const access = context('admin')
  const { grants } = await access.extrasContext()
  assert.equal(grants.length, 2)
  assert.ok(grants.every(grant => grant.role === 'diretor'))
  assert.throws(() => access.requireExtraAccess(grants, other, 'lider'))
  assert.throws(() => access.requireExtraAccess(grants, other, 'rh'))
  assert.throws(() => access.requireExtraAccess(grants, other, 'caixa'))

  const delegated = context('admin', ['lider', 'rh', 'caixa'].map(role => ({ unit_id: other, role })))
  const resolved = await delegated.extrasContext()
  for (const role of ['lider', 'rh', 'caixa', 'diretor']) delegated.requireExtraAccess(resolved.grants, other, role)
  assert.throws(() => delegated.requireExtraAccess(resolved.grants, other, 'financeiro'))
  assert.throws(() => delegated.requireExtraAccess(resolved.grants, outside, 'lider'))
})

test('demais usuários continuam sem liderança fora da casa e contas inativas são bloqueadas', async () => {
  for (const role of ['gerente', 'cozinheiro']) {
    const access = context(role, [{ unit_id: other, role: 'lider' }, { unit_id: outside, role: 'rh' }])
    const { grants } = await access.extrasContext()
    assert.throws(() => access.requireExtraAccess(grants, other, 'lider'))
    assert.throws(() => access.requireExtraAccess(grants, outside, 'rh'))
    if (role === 'gerente') access.requireExtraAccess(grants, home, 'lider')
  }
  await assert.rejects(context('admin', [{ unit_id: other, role: 'lider' }], false).extrasContext(), /indisponível/)
})
