import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export default async function GruposPage() {
  const supabase = createServiceClient()
  const { data: groups } = await supabase
    .from('groups')
    .select('id, name, icone, parent_id')
    .order('name')

  const groupsMap = Object.fromEntries((groups ?? []).map(g => [g.id, g.name]))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Grupos</h1>
          <p className="text-sm text-neutral-400">Categorias de produtos</p>
        </div>
        <Link href="/cadastros/grupos/novo"
          className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-100 transition-colors">
          <Plus className="h-4 w-4" />
          Novo grupo
        </Link>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900">
        <div className="divide-y divide-neutral-800">
          {(groups ?? []).length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-neutral-500">Nenhum grupo cadastrado.</p>
          )}
          {(groups ?? []).map(g => (
            <div key={g.id} className="flex items-center justify-between px-5 py-3 hover:bg-neutral-800/50 transition-colors">
              <div className="flex items-center gap-3">
                {g.icone && <span className="text-xl">{g.icone}</span>}
                <div>
                  <p className="text-sm font-medium text-white">{g.name}</p>
                  {g.parent_id && (
                    <p className="text-xs text-neutral-500">Subgrupo de: {groupsMap[g.parent_id] ?? '—'}</p>
                  )}
                </div>
              </div>
              <Link href={`/cadastros/grupos/${g.id}`}
                className="text-xs text-neutral-500 hover:text-white transition-colors">
                Editar
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
