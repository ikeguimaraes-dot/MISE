import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { LabelForm } from './_components/label-form'

type SearchParams = Promise<{ unit?: string; status?: string; page?: string }>

const STATUS_BADGE: Record<string, string> = {
  ativa: 'text-emerald-400 bg-emerald-400/10',
  consumida: 'text-blue-400 bg-blue-400/10',
  descartada: 'text-red-400 bg-red-400/10',
  vencida: 'text-orange-400 bg-orange-400/10',
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
        <h1 className="text-xl font-bold text-white">Etiquetas</h1>
        <p className="text-sm text-neutral-400">Gerar e consultar etiquetas de validade</p>
      </div>

      <LabelForm
        ingredients={ingredients ?? []}
        menuItems={menuItems ?? []}
        employees={employees ?? []}
        units={units ?? []}
      />

      <div className="rounded-xl border border-neutral-800 bg-neutral-900">
        <div className="border-b border-neutral-800 px-5 py-4">
          <p className="text-sm font-semibold text-white">Histórico de Etiquetas</p>
        </div>

        <form method="GET" className="flex flex-wrap gap-3 px-5 py-3 border-b border-neutral-800">
          <select name="unit" defaultValue={unit ?? ''}
            className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-white focus:outline-none">
            <option value="">Todas as unidades</option>
            {(units ?? []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select name="status" defaultValue={status ?? ''}
            className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-white focus:outline-none">
            <option value="">Todos os status</option>
            <option value="ativa">Ativa</option>
            <option value="consumida">Consumida</option>
            <option value="descartada">Descartada</option>
            <option value="vencida">Vencida</option>
          </select>
          <button type="submit"
            className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-neutral-100 transition-colors">
            Filtrar
          </button>
          {(unit || status) && (
            <Link href="/etiquetas" className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-400 hover:text-white transition-colors">
              Limpar
            </Link>
          )}
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800">
                {['Produto', 'Tipo', 'Unidade', 'Responsável', 'Manipulação', 'Validade', 'Status', 'Peso'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium text-neutral-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {(labels ?? []).map(l => (
                <tr key={l.id} className="hover:bg-neutral-800/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-white">{l.nome}</td>
                  <td className="px-5 py-3 text-neutral-400 capitalize">{l.tipo}</td>
                  <td className="px-5 py-3 text-neutral-400">{unitsMap[l.unit_id] ?? '—'}</td>
                  <td className="px-5 py-3 text-neutral-400">{empsMap[l.employee_id ?? ''] ?? '—'}</td>
                  <td className="px-5 py-3 text-neutral-400">{formatDate(l.data_manipulacao)}</td>
                  <td className="px-5 py-3 text-neutral-400">{formatDate(l.validade)}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[l.status] ?? ''}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-neutral-400">
                    {l.peso_kg != null ? `${(l.peso_kg * 1000).toLocaleString('pt-BR')} g` : '—'}
                  </td>
                </tr>
              ))}
              {(labels ?? []).length === 0 && (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-neutral-500">Nenhuma etiqueta encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-neutral-800 px-5 py-3">
            <p className="text-xs text-neutral-500">
              {count} etiqueta{count !== 1 ? 's' : ''} · página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={`?${new URLSearchParams({ ...(unit ? { unit } : {}), ...(status ? { status } : {}), page: String(page - 1) })}`}
                  className="rounded border border-neutral-700 px-3 py-1 text-xs text-neutral-400 hover:text-white transition-colors">
                  Anterior
                </Link>
              )}
              {page < totalPages && (
                <Link href={`?${new URLSearchParams({ ...(unit ? { unit } : {}), ...(status ? { status } : {}), page: String(page + 1) })}`}
                  className="rounded border border-neutral-700 px-3 py-1 text-xs text-neutral-400 hover:text-white transition-colors">
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
