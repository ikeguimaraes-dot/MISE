import { createServiceClient } from '@/lib/supabase/server'

function getTodayStart(): string {
  const spDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  return `${spDate}T00:00:00-03:00`
}

function getTodayEnd(): string {
  const sp = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  sp.setDate(sp.getDate() + 1)
  const y = sp.getFullYear()
  const m = String(sp.getMonth() + 1).padStart(2, '0')
  const d = String(sp.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}T00:00:00-03:00`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

const STATUS_BADGE: Record<string, string> = {
  ativa: 'text-emerald-400 bg-emerald-400/10',
  consumida: 'text-blue-400 bg-blue-400/10',
  descartada: 'text-red-400 bg-red-400/10',
  vencida: 'text-orange-400 bg-orange-400/10',
}

export default async function DashboardPage() {
  const supabase = createServiceClient()
  const todayStart = getTodayStart()
  const todayEnd = getTodayEnd()

  const [
    { count: labelsHoje },
    { data: labelsAtivas },
    { count: producoesDia },
    { count: descartesDia },
    { data: ultimasLabels },
    { data: units },
    { data: employees },
  ] = await Promise.all([
    supabase.schema('mise').from('labels').select('id', { count: 'exact', head: true })
      .gte('data_manipulacao', todayStart).lt('data_manipulacao', todayEnd),
    supabase.schema('mise').from('labels').select('id, nome, unit_id, employee_id, validade, status')
      .eq('status', 'ativa').order('validade', { ascending: true }),
    supabase.schema('mise').from('production_orders').select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart).lt('created_at', todayEnd),
    supabase.schema('mise').from('labels').select('id', { count: 'exact', head: true })
      .eq('status', 'descartada').gte('created_at', todayStart).lt('created_at', todayEnd),
    supabase.schema('mise').from('labels').select('id, nome, unit_id, employee_id, data_manipulacao, validade, status')
      .order('data_manipulacao', { ascending: false }).limit(10),
    supabase.from('units').select('id, name').eq('active', true),
    supabase.from('employees').select('id, nome').eq('ativo', true),
  ])

  const unitsMap = Object.fromEntries((units ?? []).map(u => [u.id, u.name]))
  const employeesMap = Object.fromEntries((employees ?? []).map(e => [e.id, e.nome]))

  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const criticas = (labelsAtivas ?? []).filter(l => new Date(l.validade) <= in24h)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-neutral-400">Visão geral do dia</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Etiquetas Hoje', value: labelsHoje ?? 0, color: 'text-emerald-400' },
          { label: 'Validades Críticas', value: criticas.length, color: 'text-orange-400' },
          { label: 'Produções do Dia', value: producoesDia ?? 0, color: 'text-blue-400' },
          { label: 'Descartes do Dia', value: descartesDia ?? 0, color: 'text-red-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-xs font-medium text-neutral-400">{label}</p>
            <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900">
          <div className="border-b border-neutral-800 px-5 py-4">
            <p className="text-sm font-semibold text-white">Últimas 10 Etiquetas</p>
          </div>
          <div className="divide-y divide-neutral-800">
            {(ultimasLabels ?? []).length === 0 && (
              <p className="px-5 py-4 text-sm text-neutral-500">Nenhuma etiqueta.</p>
            )}
            {(ultimasLabels ?? []).map(l => (
              <div key={l.id} className="flex items-center justify-between px-5 py-3 hover:bg-neutral-800/50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-white">{l.nome}</p>
                  <p className="text-xs text-neutral-500">{unitsMap[l.unit_id] ?? '—'} · {employeesMap[l.employee_id ?? ''] ?? '—'}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[l.status] ?? ''}`}>
                    {l.status}
                  </span>
                  <p className="mt-1 text-xs text-neutral-500">{formatDate(l.validade)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900">
          <div className="border-b border-neutral-800 px-5 py-4">
            <p className="text-sm font-semibold text-white">Validades Críticas (24h)</p>
          </div>
          <div className="divide-y divide-neutral-800">
            {criticas.length === 0 && (
              <p className="px-5 py-4 text-sm text-neutral-500">Sem validades críticas.</p>
            )}
            {criticas.map(l => {
              const diff = new Date(l.validade).getTime() - now.getTime()
              const isExpired = diff < 0
              return (
                <div key={l.id} className="flex items-center justify-between px-5 py-3 hover:bg-neutral-800/50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-white">{l.nome}</p>
                    <p className="text-xs text-neutral-500">{unitsMap[l.unit_id] ?? '—'}</p>
                  </div>
                  <p className={`text-xs font-medium ${isExpired ? 'text-red-400' : 'text-orange-400'}`}>
                    {isExpired ? 'VENCIDA' : `${Math.floor(diff / 3600000)}h restantes`}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
