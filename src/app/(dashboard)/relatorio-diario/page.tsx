import { createServiceClient } from '@/lib/supabase/server'
import { getMiseSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

function getStatusDot(status: string, dataStr: string): { cor: string; label: string } {
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  if (status === 'enviado' || status === 'auditado') return { cor: 'bg-fresh', label: status === 'auditado' ? 'Auditado' : 'Enviado' }
  if (dataStr === hoje) return { cor: 'bg-warn', label: 'Em aberto' }
  return { cor: 'bg-alert', label: 'Não enviado' }
}

function fmtDia(dataStr: string): string {
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  if (dataStr === hoje) return 'Hoje'
  const d = new Date(`${dataStr}T12:00:00Z`)
  return d.toLocaleDateString('pt-BR', {
    weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC',
  })
}

export default async function RelatorioDiarioPage({
  searchParams,
}: {
  searchParams: Promise<{ unit_id?: string }>
}) {
  const session = await getMiseSession()
  if (!session) redirect('/login')
  if (session.role === 'cozinheiro') redirect('/')

  const { unit_id } = await searchParams
  const supabase = createServiceClient()

  const { data: units } = await supabase
    .from('units')
    .select('id, name')
    .eq('active', true)
    .order('name')

  const activeUnitId = unit_id ?? units?.[0]?.id ?? ''

  const since = new Date()
  since.setDate(since.getDate() - 30)
  const sinceStr = since.toISOString().slice(0, 10)

  const { data: relatorios } = activeUnitId
    ? await supabase
        .from('op_relatorio_diario')
        .select('id, data, status')
        .eq('unit_id', activeUnitId)
        .gte('data', sinceStr)
        .order('data', { ascending: false })
    : { data: [] }

  const unitName = units?.find(u => u.id === activeUnitId)?.name ?? ''
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const temHoje = relatorios?.some(r => r.data === hoje)

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Relatório Diário</h1>
          <p className="text-sm text-ink-muted">{unitName} · últimos 30 dias</p>
        </div>
        <Link
          href={`/relatorio-diario/${hoje}?unit_id=${activeUnitId}`}
          className="rounded-lg bg-ember px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          {temHoje ? 'Continuar hoje' : 'Preencher hoje'}
        </Link>
      </div>

      {(units?.length ?? 0) > 1 && (
        <div className="flex gap-2 flex-wrap">
          {units?.map(u => (
            <Link
              key={u.id}
              href={`?unit_id=${u.id}`}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                u.id === activeUnitId
                  ? 'border-ember bg-ember/10 text-ember'
                  : 'border-edge text-ink-muted hover:text-ink'
              }`}
            >
              {u.name}
            </Link>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-edge bg-surface divide-y divide-edge">
        {(relatorios?.length ?? 0) === 0 && (
          <p className="px-5 py-8 text-center text-sm text-ink-subtle">
            Nenhum relatório nos últimos 30 dias.
          </p>
        )}
        {relatorios?.map(r => {
          const { cor, label } = getStatusDot(r.status, r.data)
          return (
            <Link
              key={r.id}
              href={`/relatorio-diario/${r.data}?unit_id=${activeUnitId}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-surface-raised/50 transition-colors"
            >
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${cor}`} />
              <span className="flex-1 text-sm font-medium text-ink">{fmtDia(r.data)}</span>
              <span className="text-xs text-ink-muted">{label}</span>
              <ChevronRight className="h-4 w-4 text-ink-faint" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
