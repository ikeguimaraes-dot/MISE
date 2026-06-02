import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft, History } from 'lucide-react'

function scoreColor(pct: number) {
  if (pct >= 80) return 'text-emerald-400 bg-emerald-400/10'
  if (pct >= 60) return 'text-yellow-400 bg-yellow-400/10'
  return 'text-red-400 bg-red-400/10'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export default async function ChecklistHistoricoPage() {
  const supabase = createServiceClient()

  const [
    { data: execucoes },
    { data: templates },
    { data: units },
  ] = await Promise.all([
    supabase.schema('mise').from('checklist_executions').select('*').eq('status', 'concluido').order('concluido_em', { ascending: false }).limit(200),
    supabase.schema('mise').from('checklist_templates').select('id, nome'),
    supabase.from('units').select('id, name'),
  ])

  const templatesMap = Object.fromEntries((templates ?? []).map(t => [t.id, t.nome]))
  const unitsMap = Object.fromEntries((units ?? []).map(u => [u.id, u.name]))

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <Link href="/checklists" className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-300 mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Checklists
        </Link>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <History className="h-5 w-5 text-neutral-400" />
          Histórico de Execuções
        </h1>
        <p className="mt-1 text-sm text-neutral-500">Todas as execuções concluídas</p>
      </div>

      {!execucoes || execucoes.length === 0 ? (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-12 text-center">
          <History className="mx-auto h-10 w-10 text-neutral-600 mb-3" />
          <p className="text-neutral-400">Nenhuma execução concluída ainda.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-neutral-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-800 bg-neutral-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Data</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Checklist</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Turno</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Unidade</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wider">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800 bg-neutral-950">
              {execucoes.map(ex => (
                <tr key={ex.id} className="hover:bg-neutral-900 transition-colors">
                  <td className="px-4 py-3 text-neutral-400 whitespace-nowrap">
                    {fmtDate(ex.concluido_em ?? ex.iniciado_em)}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/checklists/historico/${ex.id}`} className="font-medium text-white hover:text-emerald-400 transition-colors">
                      {templatesMap[ex.template_id] ?? 'Template removido'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-400">{ex.turno ?? '—'}</td>
                  <td className="px-4 py-3 text-neutral-400">{unitsMap[ex.unit_id] ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${scoreColor(ex.percentual)}`}>
                      {ex.percentual.toFixed(0)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
