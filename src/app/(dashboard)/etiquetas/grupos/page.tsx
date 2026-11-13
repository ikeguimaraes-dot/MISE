import { FolderTree } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase/server'
import { EtiquetasBack, EtiquetasCards } from '../_components/etiquetas-navigation'

export default async function GruposPage() {
  const supabase = createServiceClient()
  const { data: groups, error } = await supabase.from('groups').select('id, name, parent_id').order('name')
  if (error) throw new Error('Não foi possível carregar os grupos. Tente novamente.')
  const names = new Map((groups ?? []).map(group => [group.id, group.name]))

  return <div className="mx-auto max-w-6xl space-y-6 p-6 sm:p-8">
    <EtiquetasBack />
    <div><h1 className="text-2xl font-bold text-ink">Grupos</h1><p className="mt-2 text-sm text-ink-muted">Escolha um grupo para ver os produtos e emitir uma etiqueta.</p></div>
    <EtiquetasCards cards={(groups ?? []).map(group => ({
      title: group.name,
      description: group.parent_id ? `Subgrupo de ${names.get(group.parent_id) ?? 'outro grupo'}. Ver produtos.` : 'Ver os produtos deste grupo.',
      href: `/etiquetas/grupos/${group.id}`,
      icon: FolderTree,
    }))} />
    {!groups?.length && <p className="rounded-xl border border-edge bg-surface p-8 text-center text-sm text-ink-muted">Nenhum grupo cadastrado.</p>}
  </div>
}
