import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, FolderTree, Tag } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase/server'
import { EtiquetasBack, EtiquetasCards } from '../../_components/etiquetas-navigation'

export default async function ProdutosDoGrupoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const [groupResult, productsResult, childrenResult] = await Promise.all([
    supabase.from('groups').select('id, name').eq('id', id).maybeSingle(),
    supabase.from('ingredients').select('id, nome').eq('group_id', id).eq('ativo', true).order('nome'),
    supabase.from('groups').select('id, name').eq('parent_id', id).order('name'),
  ])
  if (groupResult.error || productsResult.error || childrenResult.error) throw new Error('Não foi possível carregar os produtos do grupo. Tente novamente.')
  if (!groupResult.data) notFound()
  const products = productsResult.data ?? []
  const children = childrenResult.data ?? []

  return <div className="mx-auto max-w-6xl space-y-6 p-6 sm:p-8">
    <EtiquetasBack href="/etiquetas/grupos">Voltar para Grupos</EtiquetasBack>
    <div><p className="section-eyebrow mb-2">PRODUTOS DO GRUPO</p><h1 className="text-2xl font-bold text-ink">{groupResult.data.name}</h1><p className="mt-2 text-sm text-ink-muted">Selecione um produto para abrir uma nova etiqueta.</p></div>
    {children.length > 0 && <section aria-label="Subgrupos" className="space-y-3">
      <h2 className="text-sm font-semibold text-ink">Subgrupos</h2>
      <EtiquetasCards cards={children.map(group => ({ title: group.name, description: 'Ver produtos deste subgrupo.', href: `/etiquetas/grupos/${group.id}`, icon: FolderTree }))} />
    </section>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {products.map(product => <Link key={product.id} href={`/etiquetas/nova?ingredient=${encodeURIComponent(product.id)}`} className="flex items-center gap-4 rounded-xl border border-edge bg-surface p-5 transition-colors hover:border-ember/50 hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ember">
        <Tag size={20} className="shrink-0 text-ember" />
        <span className="min-w-0 flex-1"><span className="block font-medium text-ink">{product.nome}</span><span className="mt-1 block text-xs text-ink-muted">Emitir etiqueta</span></span>
        <ArrowRight size={16} className="shrink-0 text-ink-muted" />
      </Link>)}
    </div>
    {!products.length && <p className="rounded-xl border border-edge bg-surface p-8 text-center text-sm text-ink-muted">Nenhum produto ativo cadastrado neste grupo.{children.length > 0 ? ' Escolha um subgrupo acima para ver seus produtos.' : ''}</p>}
  </div>
}
