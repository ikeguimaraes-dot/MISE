import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { LabelForm } from './_components/label-form'

type SearchParams = Promise<{ unit?: string; status?: string; page?: string }>

const STATUS_BADGE: Record<string, string> = {
  ativa: 'text-fresh-bright bg-fresh/10',
  consumida: 'text-info bg-info/10',
  descartada: 'text-alert-bright bg-alert/10',
  vencida: 'text-warn-bright bg-warn/10',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export default async function EtiquetasPage({ searchParams }: { searchParams: SearchParams }) {
  const { unit, status, page: pageParam } = await searchParams
  const page = Math.max(1, Number(pageParam) || 1)
  const pageSize = 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const supabase = createServiceClient()

  const [
    { data: units },
    { data: ingredients },
    { data: menuItems },
    { data: employees },
  ] = await Promise.all([
    supabase.from('units').select('id, name, cnpj, address').eq('active', true),
    supabase.from('ingredients').select('id, nome, categoria_anvisa').eq('ativo', true).order('nome'),
    supabase.from('menu_items').select('id, nome').order('nome'),
    supabase.from('employees').select('id, nome').eq('ativo', true).eq('mise_ativo', true).order('nome'),
  ])

  let query = supabase.schema('mise').from('labels')
    .select('id, unit_id, employee_id, nome, tipo, peso_kg, data_manipulacao, validade, status', { count: 'exact' })
    .order('data_manipulacao', { ascending: false })
    .range(from, to)

  if (unit) query = query.eq('unit_id', unit)
  if (status) query = query.eq('status', status)

  const { data: labels, count } = await query

  const unitIds = Array.from(new Set(labels?.map(l => l.unit_id) ?? []))
  const empIds = Array.from(new Set(labels?.map(l => l.employee_id).filter(Boolean) ?? []))

  const [{ data: labelUnits }, { data: labelEmps }] = await Promise.all([
    unitIds.length ? supabase.from('units').select('id, name').in('id', unitIds) : Promise.resolve({ data: [] }),
    empIds.length ? supabase.from('employees').select('id, nome').in('id', empIds as string[]) : Promise.resolve({ data: [] }),
  ])

  const unitsMap = Object.fromEntries((labelUnits ?? []).map(u => [u.id, u.name]))
  const empsMap = Object.fromEntries((labelEmps ?? []).map(e => [e.id, e.nome]))

  const totalPages = Math.ceil((count ?? 0) / pageSize)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Etiquetas</h1>
        <p className="text-sm text-ink-muted">Gerar e consultar etiquetas de validade</p>
      </div>

      <LabelForm
        ingredients={ingredients ?? []}
        menuItems={menuItems ?? []}
        employees={employees ?? []}
        units={units ?? []}
      />

      <div className="rounded-xl border border-edge bg-surface">
        <div className="border-b border-edge px-5 py-4">
          <p className="text-sm font-semibold text-ink">Histórico de Etiquetas</p>
        </div>

        <form method="GET" className="flex flex-wrap gap-3 px-5 py-3 border-b border-edge">
          <select name="unit" defaultValue={unit ?? ''}
            className="rounded-lg border border-edge-strong bg-surface-raised px-3 py-1.5 text-sm text-ink focus:outline-none">
            <option value="">Todas as unidades</option>
            {(units ?? []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select name="status" defaultValue={status ?? ''}
            className="rounded-lg border border-edge-strong bg-surface-raised px-3 py-1.5 text-sm text-ink focus:outline-none">
            <option value="">Todos os status</option>
            <option value="ativa">Ativa</option>
            <option value="consumida">Consumida</option>
            <option value="descartada">Descartada</option>
            <option value="vencida">Vencida</option>
          </select>
          <button type="submit"
            className="rounded-lg bg-ember px-3 py-1.5 text-sm font-medium text-ember-ink hover:bg-ember-hover transition-colors">
            Filtrar
          </button>
          {(unit || status) && (
            <Link href="/etiquetas" className="rounded-lg border border-edge-strong px-3 py-1.5 text-sm text-ink-muted hover:text-ink transition-colors">
              Limpar
            </Link>
          )}
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge">
                {['Produto', 'Tipo', 'Unidade', 'Responsável', 'Manipulação', 'Validade', 'Status', 'Peso'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium text-ink-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {(labels ?? []).map(l => (
                <tr key={l.id} className="hover:bg-surface-raised/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-ink">{l.nome}</td>
                  <td className="px-5 py-3 text-ink-muted capitalize">{l.tipo}</td>
                  <td className="px-5 py-3 text-ink-muted">{unitsMap[l.unit_id] ?? '—'}</td>
                  <td className="px-5 py-3 text-ink-muted">{empsMap[l.employee_id ?? ''] ?? '—'}</td>
                  <td className="px-5 py-3 text-ink-muted">{formatDate(l.data_manipulacao)}</td>
                  <td className="px-5 py-3 text-ink-muted">{formatDate(l.validade)}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[l.status] ?? ''}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-ink-muted">
                    {l.peso_kg != null ? `${(l.peso_kg * 1000).toLocaleString('pt-BR')} g` : '—'}
                  </td>
                </tr>
              ))}
              {(labels ?? []).length === 0 && (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-ink-subtle">Nenhuma etiqueta encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-edge px-5 py-3">
            <p className="text-xs text-ink-subtle">
              {count} etiqueta{count !== 1 ? 's' : ''} · página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={`?${new URLSearchParams({ ...(unit ? { unit } : {}), ...(status ? { status } : {}), page: String(page - 1) })}`}
                  className="rounded border border-edge-strong px-3 py-1 text-xs text-ink-muted hover:text-ink transition-colors">
                  Anterior
                </Link>
              )}
              {page < totalPages && (
                <Link href={`?${new URLSearchParams({ ...(unit ? { unit } : {}), ...(status ? { status } : {}), page: String(page + 1) })}`}
                  className="rounded border border-edge-strong px-3 py-1 text-xs text-ink-muted hover:text-ink transition-colors">
                  Próxima
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
