import { createServiceClient } from '@/lib/supabase/server'
import { getMiseSession } from '@/lib/session'
import { employeeRoleLabel } from '@/lib/employee-registration'
import { EmployeeAccountForm } from './_components/employee-account-form'
import { EmployeeToggle } from './_components/employee-toggle'

export default async function FuncionariosPage() {
  const session = await getMiseSession()
  if (!session || !['admin', 'gerente'].includes(session.role)) return <p className="p-6 text-sm text-ink-muted">Acesso restrito à gestão.</p>
  const isAdmin = session.role === 'admin'
  const supabase = createServiceClient()

  const { data: employees } = await supabase
    .from('employees')
    .select('id, nome, sobrenome, email, funcao, departamento, ativo, mise_ativo')
    .eq('ativo', true)
    .order('nome')

  const [units, roles] = isAdmin ? await Promise.all([
    supabase.from('units').select('id, name').eq('active', true).order('name'),
    supabase.from('roles').select('id, name, description').order('name'),
  ]) : [{ data: [], error: null }, { data: [], error: null }]

  const total = employees?.length ?? 0
  const ativos = employees?.filter(e => e.mise_ativo).length ?? 0

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Funcionários</h1>
        <p className="text-sm text-ink-muted">Gerencie o acesso ao MISE</p>
      </div>

      {isAdmin && (units.error || roles.error ? <p role="alert" className="text-sm text-alert-bright">Não foi possível carregar unidades e cargos para o cadastro.</p> : <EmployeeAccountForm units={(units.data ?? []).map(unit => ({ id: unit.id, label: unit.name }))} roles={(roles.data ?? []).map(role => ({ id: role.id, label: employeeRoleLabel(role) }))} />)}
      {employees === null && <p role="alert" className="text-sm text-alert-bright">Não foi possível carregar os funcionários.</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: 'Total de funcionários', value: total, color: 'text-ink' },
          { label: 'Ativos no MISE', value: ativos, color: 'text-fresh' },
          { label: 'Sem acesso', value: total - ativos, color: 'text-ink-muted' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-edge bg-surface p-4">
            <p className="text-xs font-medium text-ink-muted">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-edge bg-surface">
        <div className="border-b border-edge px-5 py-4">
          <p className="text-sm font-semibold text-ink">Funcionários ativos</p>
        </div>
        <div className="divide-y divide-edge">
          {(employees ?? []).map(e => (
            <div key={e.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-sm font-medium text-ink">{e.nome} {e.sobrenome}</p>
                <p className="text-xs text-ink-muted">{e.email ?? 'Sem login por e-mail'} · {e.funcao ?? 'Sem cargo'}</p>
                <p className="text-xs text-ink-subtle">{e.departamento ?? 'Sem departamento'}</p>
              </div>
              {isAdmin ? <EmployeeToggle id={e.id} miseAtivo={e.mise_ativo ?? false} /> : <span className="text-xs text-ink-muted">{e.mise_ativo ? 'Ativo no MISE' : 'Sem acesso'}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
