import { createServiceClient } from '@/lib/supabase/server'
import { getMiseSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ShieldCheck, ChevronRight, Plus } from 'lucide-react'

const ORDEM_UNIDADES = ['Meet & Eat', 'Match Point', 'Madonna SP Itaim', 'Frenezze', 'HOS']
const CATEGORIAS = ['documentacao', 'operacional', 'estrutural'] as const
const CATEGORIA_LABEL: Record<string, string> = {
  documentacao: 'Documentação',
  operacional: 'Operacional',
  estrutural: 'Estrutural',
}

function fmtData(d: string): string {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
  })
}

export default async function CrivoPage() {
  const session = await getMiseSession()
  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect('/')

  const supabase = createServiceClient()

  const [{ data: unitsRaw }, { data: templates }] = await Promise.all([
    supabase.from('units').select('id, name').eq('active', true),
    supabase.schema('mise').from('checklist_templates')
      .select('id, categoria, unit_id')
      .eq('modulo', 'CRIVO')
      .eq('ativo', true),
  ])

  const units = (unitsRaw ?? []).sort((a, b) => {
    const ia = ORDEM_UNIDADES.indexOf(a.name)
    const ib = ORDEM_UNIDADES.indexOf(b.name)
    if (ia === -1 && ib === -1) return a.name.localeCompare(b.name)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })

  const templateIds = (templates ?? []).map(t => t.id)
  const { data: execucoes } = templateIds.length
    ? await supabase.schema('mise').from('checklist_executions')
        .select('unit_id, template_id, percentual, concluido_em')
        .in('template_id', templateIds)
        .eq('status', 'concluido')
        .order('concluido_em', { ascending: false })
    : { data: [] }

  const catMap = new Map((templates ?? []).map(t => [t.id, t.categoria as string | null]))

  // unit_id → categoria → {percentual, data}
  const scoreMap = new Map<string, Map<string, { percentual: number | null; data: string }>>()
  for (const ex of (execucoes ?? [])) {
    const cat = catMap.get(ex.template_id)
    if (!cat || !ex.unit_id) continue
    const unitMap = scoreMap.get(ex.unit_id) ?? new Map()
    if (!unitMap.has(cat)) {
      unitMap.set(cat, { percentual: ex.percentual, data: ex.concluido_em?.slice(0, 10) ?? '' })
    }
    scoreMap.set(ex.unit_id, unitMap)
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-ink-muted" />
            CRIVO
          </h1>
          <p className="text-sm text-ink-muted">Auditorias sanitárias por unidade</p>
        </div>
        <Link
          href="/crivo/templates"
          className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Templates
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {units.map(u => {
          const unitScores = scoreMap.get(u.id)
          const ultimaVisita = CATEGORIAS.map(c => unitScores?.get(c)?.data).filter(Boolean)[0] ?? null
          return (
            <Link
              key={u.id}
              href={`/crivo/${u.id}`}
              className="rounded-xl border border-edge bg-surface p-4 hover:bg-surface-raised/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-ink">{u.name}</span>
                <ChevronRight className="h-4 w-4 text-ink-faint" />
              </div>
              <div className="space-y-1.5">
                {CATEGORIAS.map(cat => {
                  const score = unitScores?.get(cat)
                  const pct = score?.percentual
                  const cor = pct == null
                    ? 'text-ink-faint'
                    : pct >= 80 ? 'text-fresh-bright'
                    : pct >= 60 ? 'text-warn-bright'
                    : 'text-alert-bright'
                  return (
                    <div key={cat} className="flex items-center justify-between text-xs">
                      <span className="text-ink-muted">{CATEGORIA_LABEL[cat]}</span>
                      <span className={`font-semibold ${cor}`}>
                        {pct != null ? `${pct.toFixed(0)}%` : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
              {ultimaVisita && (
                <p className="mt-2.5 text-[10px] text-ink-faint">Última visita: {fmtData(ultimaVisita)}</p>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
