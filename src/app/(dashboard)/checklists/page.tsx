import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ClipboardCheck, Plus } from 'lucide-react'

const TIPO_COLORS: Record<string, string> = {
  abertura: 'border-l-emerald-500 bg-emerald-500/5',
  fechamento: 'border-l-red-500 bg-red-500/5',
  rotina: 'border-l-blue-500 bg-blue-500/5',
  relatorio: 'border-l-purple-500 bg-purple-500/5',
  treinamento: 'border-l-yellow-500 bg-yellow-500/5',
}

const TIPO_LABEL: Record<string, string> = {
  abertura: 'Abertura', fechamento: 'Fechamento', rotina: 'Rotina',
  relatorio: 'Relatório', treinamento: 'Treinamento',
}

function scoreColor(pct: number | null) {
  if (pct === null) return 'text-neutral-500'
  if (pct >= 80) return 'text-emerald-400'
  if (pct >= 60) return 'text-yellow-400'
  return 'text-red-400'
}

export default async function ChecklistsPage() {
  const supabase = createServiceClient()

  const [
    { data: templates, error: errTemplates },
    { data: items, error: errItems },
    { data: lastExecs, error: errExecs },
    { data: units, error: errUnits },
  ] = await Promise.all([
    supabase.schema('mise').from('checklist_templates').select('*').eq('ativo', true).order('nome'),
    supabase.schema('mise').from('checklist_template_items').select('template_id', { count: 'exact' }),
    supabase.schema('mise').from('checklist_executions').select('template_id, percentual, concluido_em').eq('status', 'concluido').order('concluido_em', { ascending: false }),
    supabase.from('units').select('id, name').eq('active', true),
  ])

  console.error('MISE DEBUG templates:', errTemplates)
  console.error('MISE DEBUG items:', errItems)
  console.error('MISE DEBUG execs:', errExecs)
  console.error('MISE DEBUG units:', errUnits)

  // Count items per template
  const itemCountMap: Record<string, number> = {}
  for (const it of (items ?? [])) {
    itemCountMap[it.template_id] = (itemCountMap[it.template_id] ?? 0) + 1
  }

  // Last score per template
  const lastScoreMap: Record<string, number | null> = {}
  for (const ex of (lastExecs ?? [])) {
    if (!(ex.template_id in lastScoreMap)) {
      lastScoreMap[ex.template_id] = ex.percentual
    }
  }

  const unitsMap = Object.fromEntries((units ?? []).map(u => [u.id, u.name]))

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-emerald-400" />
            Checklists
          </h1>
          <p className="mt-1 text-sm text-neutral-400">Checklists operacionais — substitui o Checkbits</p>
        </div>
        <Link
          href="/checklists/novo"
          className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Checklist
        </Link>
      </div>

      {!templates || templates.length === 0 ? (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-12 text-center">
          <ClipboardCheck className="mx-auto h-10 w-10 text-neutral-600 mb-3" />
          <p className="text-neutral-400">Nenhum checklist cadastrado.</p>
          <Link href="/checklists/novo" className="mt-4 inline-block text-sm text-emerald-400 hover:text-emerald-300">
            Criar primeiro checklist →
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map(t => {
            const score = lastScoreMap[t.id] ?? null
            const count = itemCountMap[t.id] ?? 0
            const colorClass = TIPO_COLORS[t.tipo ?? ''] ?? 'border-l-neutral-600 bg-neutral-800/30'
            return (
              <div
                key={t.id}
                className={`rounded-lg border border-neutral-800 border-l-4 ${colorClass} bg-neutral-900 p-5 flex flex-col gap-3`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-white leading-tight">{t.nome}</h3>
                  {t.tipo && (
                    <span className="shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-neutral-800 text-neutral-400">
                      {TIPO_LABEL[t.tipo] ?? t.tipo}
                    </span>
                  )}
                </div>

                {t.departamento && (
                  <p className="text-xs text-neutral-500">{t.departamento}</p>
                )}

                {t.unit_id && (
                  <p className="text-xs text-neutral-600">{unitsMap[t.unit_id] ?? t.unit_id}</p>
                )}

                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <span>{count} {count === 1 ? 'item' : 'itens'}</span>
                  <span>
                    Última: <span className={`font-bold ${scoreColor(score)}`}>
                      {score !== null ? `${score.toFixed(0)}%` : '—'}
                    </span>
                  </span>
                </div>

                <div className="flex gap-2 pt-1">
                  <Link
                    href={`/checklists/${t.id}`}
                    className="flex-1 rounded border border-neutral-700 px-3 py-1.5 text-center text-xs font-medium text-neutral-300 hover:bg-neutral-800 transition-colors"
                  >
                    Ver detalhes
                  </Link>
                  <Link
                    href={`/checklists/${t.id}`}
                    className="flex-1 rounded bg-emerald-700 px-3 py-1.5 text-center text-xs font-bold text-white hover:bg-emerald-600 transition-colors"
                  >
                    Executar
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
