import { createServiceClient } from '@/lib/supabase/server'
import { getMiseSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PERIODO_LABEL } from '@/app/api/relatorio-diario/_schema'

function getStatusDot(status: string | null, dataStr: string): { cor: string; label: string } {
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  if (!status) return { cor: 'bg-ink-faint', label: 'Sem relatório' }
  if (status === 'enviado' || status === 'auditado') return { cor: 'bg-fresh', label: status === 'auditado' ? 'Auditado' : 'Enviado' }
  if (dataStr === hoje) return { cor: 'bg-warn', label: 'Em aberto' }
  return { cor: 'bg-alert', label: 'Não enviado' }
}

function fmtDataPorExtenso(dataParam: string): string {
  const d = new Date(`${dataParam}T12:00:00Z`)
  const diaSemana = d.toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' })
  const dia = d.toLocaleDateString('pt-BR', { day: 'numeric', timeZone: 'UTC' })
  const mes = d.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' })
  return `${diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)}, ${dia} de ${mes}`
}

function addDias(dataStr: string, dias: number): string {
  const d = new Date(`${dataStr}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

const ORDEM_UNIDADES = ['Meet & Eat', 'Match Point', 'Madonna SP Itaim', 'Frenezze', 'HOS']

export default async function PainelGeralPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>
}) {
  const session = await getMiseSession()
  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect('/relatorio-diario')

  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const { data: dataParamRaw } = await searchParams
  const dataParam = dataParamRaw || hoje

  const supabase = createServiceClient()

  const { data: unitsRaw } = await supabase.from('units').select('id, name').eq('active', true)
  const units = (unitsRaw ?? []).sort((a, b) => {
    const ia = ORDEM_UNIDADES.indexOf(a.name)
    const ib = ORDEM_UNIDADES.indexOf(b.name)
    if (ia === -1 && ib === -1) return a.name.localeCompare(b.name)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
  const unitIds = units.map(u => u.id)

  const [{ data: relatorios }, { data: unitConfigs }] = await Promise.all([
    supabase.from('op_relatorio_diario').select('id, unit_id, status').in('unit_id', unitIds).eq('data', dataParam),
    supabase.from('op_unit_config').select('unit_id, periodos').in('unit_id', unitIds),
  ])

  const relIds = (relatorios ?? []).map(r => r.id)
  const { data: periodosDb } = relIds.length
    ? await supabase.from('op_relatorio_periodo').select('relatorio_id, periodo, sequencia, status, enviado_em').in('relatorio_id', relIds)
    : { data: [] }

  const configMap = new Map((unitConfigs ?? []).map(c => [c.unit_id, (c.periodos as string[] | null) ?? ['almoco', 'jantar']]))
  const periodosPorRel = new Map<string, { periodo: string; sequencia: number; status: string }[]>()
  for (const p of periodosDb ?? []) {
    const arr = periodosPorRel.get(p.relatorio_id) ?? []
    arr.push({
      periodo: p.periodo,
      sequencia: Number(p.sequencia ?? 1),
      status: p.enviado_em ? 'enviado' : (p.status ?? 'rascunho'),
    })
    periodosPorRel.set(p.relatorio_id, arr)
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Painel Geral</h1>
          <p className="text-sm text-ink-muted capitalize">
            {fmtDataPorExtenso(dataParam)}{dataParam === hoje ? ' · Hoje' : ''}
          </p>
        </div>
        <div className="flex gap-1">
          <Link
            href={`/relatorio-diario/painel-geral?data=${addDias(dataParam, -1)}`}
            className="rounded-lg border border-edge p-2 text-ink-muted hover:text-ink transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <Link
            href={`/relatorio-diario/painel-geral?data=${addDias(dataParam, 1)}`}
            className="rounded-lg border border-edge p-2 text-ink-muted hover:text-ink transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {units.map(u => {
          const rel = relatorios?.find(r => r.unit_id === u.id)
          const { cor, label } = getStatusDot(rel?.status ?? null, dataParam)
          const periodosAtivos = configMap.get(u.id) ?? ['almoco', 'jantar']
          const rowsPorDia = rel ? (periodosPorRel.get(rel.id) ?? []) : []

          const CHIP_ORDER = ['manha', 'almoco', 'jantar']
          const baseChips = periodosAtivos
            .filter(p => p !== 'eventos' && p !== 'manha')
            .map(p => ({
              periodo: p,
              sequencia: 1,
              status: rowsPorDia.find(r => r.periodo === p && r.sequencia === 1)?.status ?? 'pendente',
            }))
          const extraChips = rowsPorDia.filter(r => r.periodo === 'manha' || r.periodo === 'eventos')
          const allChips = [...baseChips, ...extraChips].sort((a, b) => {
            if (a.periodo === 'eventos' && b.periodo === 'eventos') return a.sequencia - b.sequencia
            if (a.periodo === 'eventos') return 1
            if (b.periodo === 'eventos') return -1
            const ia = CHIP_ORDER.indexOf(a.periodo)
            const ib = CHIP_ORDER.indexOf(b.periodo)
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
          })

          return (
            <Link
              key={u.id}
              href={`/relatorio-diario/${dataParam}?unit_id=${u.id}`}
              className="rounded-xl border border-edge bg-surface p-4 hover:bg-surface-raised/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink">{u.name}</span>
                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${cor}`} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {allChips.map(chip => {
                  const enviado = chip.status === 'enviado'
                  const na = chip.status === 'nao_se_aplica'
                  const chipLabel = chip.periodo === 'eventos'
                    ? `Evento ${chip.sequencia}`
                    : (PERIODO_LABEL[chip.periodo] ?? chip.periodo)
                  return (
                    <span
                      key={`${chip.periodo}-${chip.sequencia}`}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        enviado ? 'bg-fresh/15 text-fresh-bright' : na ? 'bg-edge/20 text-ink-faint/60' : 'bg-edge/40 text-ink-muted'
                      }`}
                    >
                      {chipLabel}
                    </span>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-ink-muted">{label}</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
