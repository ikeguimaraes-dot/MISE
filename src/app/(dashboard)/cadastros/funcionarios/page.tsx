import { createServiceClient } from '@/lib/supabase/server'
import { EmployeeToggle } from './_components/employee-toggle'

export default async function FuncionariosPage() {
  const supabase = createServiceClient()

  const { data: employees } = await supabase
    .from('employees')
    .select('id, nome, departamento, ativo, mise_ativo')
    .eq('ativo', true)
    .order('nome')

  const total = employees?.length ?? 0
  const ativos = employees?.filter(e => e.mise_ativo).length ?? 0

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Funcionários</h1>
        <p className="text-sm text-neutral-400">Gerencie o acesso ao MISE</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total de funcionários', value: total, color: 'text-white' },
          { label: 'Ativos no MISE', value: ativos, color: 'text-emerald-400' },
          { label: 'Sem acesso', value: total - ativos, color: 'text-neutral-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-xs font-medium text-neutral-400">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900">
        <div className="border-b border-neutral-800 px-5 py-4">
          <p className="text-sm font-semibold text-white">Funcionários ativos</p>
        </div>
        <div className="divide-y divide-neutral-800">
          {(employees ?? []).map(e => (
            <div key={e.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-sm font-medium text-white">{e.nome}</p>
                <p className="text-xs text-neutral-500">{e.departamento ?? 'Sem departamento'}</p>
              </div>
              <EmployeeToggle id={e.id} miseAtivo={e.mise_ativo ?? false} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
