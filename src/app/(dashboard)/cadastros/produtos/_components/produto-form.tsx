'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PRODUCT_CATEGORIES, PRODUCT_UNITS } from '@/lib/product-registration'
import { FOOD_CATEGORIES, getDefaultConservationMethod, getShelfLifeRule } from '@/lib/shelf-life'

type Group = { id: string; name: string }
type Supplier = { id: string; nome: string }

const CATEGORIAS = PRODUCT_CATEGORIES

const CATEGORIA_ANVISA = FOOD_CATEGORIES

type Initial = {
  id: string
  nome: string
  codigo: string | null
  group_id: string | null
  categoria: string
  categoria_anvisa: string | null
  unidade_padrao: string | null
  custo_padrao: number | null
  fornecedor_id: string | null
  perdas_padrao: number | null
  observacoes: string | null
  ativo: boolean
}

export function ProdutoForm({
  groups,
  suppliers,
  initial,
}: {
  groups: Group[]
  suppliers: Supplier[]
  initial?: Initial
}) {
  const [nome, setNome] = useState(initial?.nome ?? '')
  const [codigo, setCodigo] = useState(initial?.codigo ?? '')
  const [groupId, setGroupId] = useState(initial?.group_id ?? '')
  const [categoria, setCategoria] = useState(initial?.categoria ?? '')
  const [categoriaAnvisa, setCategoriaAnvisa] = useState(initial?.categoria_anvisa ?? '')
  const [unidade, setUnidade] = useState(initial?.unidade_padrao?.toLowerCase() ?? '')
  const [custo, setCusto] = useState(initial?.custo_padrao?.toString() ?? '')
  const [fornecedorId, setFornecedorId] = useState(initial?.fornecedor_id ?? '')
  const [perdas, setPerdas] = useState(initial?.perdas_padrao?.toString() ?? '')
  const [observacoes, setObservacoes] = useState(initial?.observacoes ?? '')
  const [ativo, setAtivo] = useState(initial?.ativo ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const metodoSugerido = getDefaultConservationMethod(categoriaAnvisa)
  const prazoSugerido = metodoSugerido ? getShelfLifeRule(categoriaAnvisa, metodoSugerido).prazo_horas : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim() || !groupId || !categoria || !unidade) return
    setSaving(true)
    setError('')

    const payload: Record<string, string | number | boolean | null> = {
      nome: nome.trim(),
      group_id: groupId,
      categoria,
      categoria_anvisa: categoriaAnvisa || null,
      unidade_padrao: unidade,
      ativo,
    }
    payload.codigo = codigo.trim() || null
    payload.custo_padrao = custo ? Number(custo) : null
    payload.fornecedor_id = fornecedorId || null
    payload.perdas_padrao = perdas ? Number(perdas) : null
    payload.observacoes = observacoes.trim() || null

    try {
      const res = await fetch(initial ? `/api/produtos/${initial.id}` : '/api/produtos', {
        method: initial ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || !data.id) throw new Error(data.error || 'Não foi possível confirmar a gravação do produto.')
      router.push('/cadastros/produtos')
      router.refresh()
    } catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível salvar o produto.') }
    finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Nome *</label>
          <input value={nome} onChange={e => setNome(e.target.value)} required
            className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:outline-none" />
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Código</label>
          <input value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="ex: PROD001"
            className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:outline-none" />
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Grupo *</label>
          <select value={groupId} onChange={e => setGroupId(e.target.value)} required
            className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none">
            <option value="">Selecionar grupo</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Categoria do produto *</label>
          <select value={categoria} onChange={e => setCategoria(e.target.value)} required
            className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none">
            <option value="">Selecionar</option>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="sm:col-span-2 rounded-xl border border-edge bg-surface p-4">
          <label htmlFor="product-food-category" className="block text-xs font-medium text-ink-muted mb-1">Categoria sanitária (CVS / ANVISA)</label>
          <select id="product-food-category" value={categoriaAnvisa} onChange={e => setCategoriaAnvisa(e.target.value)} aria-describedby="product-food-category-help"
            className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none">
            <option value="">Selecionar categoria sanitária</option>
            {CATEGORIA_ANVISA.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <p id="product-food-category-help" className="mt-2 text-xs leading-5 text-ink-muted">Salva no produto. Ao selecioná-lo para emitir uma etiqueta, a categoria sanitária, o método de conservação sugerido e a validade serão preenchidos automaticamente a partir da data de manipulação.</p>
          {metodoSugerido && <p aria-live="polite" className="mt-2 text-xs font-medium text-fresh-bright">Sugestão para a etiqueta: {metodoSugerido} · prazo de até {prazoSugerido}h. O método pode ser ajustado na emissão conforme o armazenamento.</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Unidade padrão *</label>
          <select value={unidade} onChange={e => setUnidade(e.target.value)} required
            className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none">
            <option value="">Selecionar unidade de medida</option>
            {PRODUCT_UNITS.map(unit => <option key={unit} value={unit}>{unit === 'l' ? 'L (litro)' : unit}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Custo padrão (R$)</label>
          <input type="number" value={custo} onChange={e => setCusto(e.target.value)} step="0.0001" min="0"
            className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none" />
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Fornecedor</label>
          <select value={fornecedorId} onChange={e => setFornecedorId(e.target.value)}
            className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none">
            <option value="">Sem fornecedor</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Perdas padrão (%)</label>
          <input type="number" value={perdas} onChange={e => setPerdas(e.target.value)} step="0.1" min="0" max="100"
            className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none" />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-ink-muted mb-1">Observações</label>
          <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2}
            className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:outline-none resize-none" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm text-ink-muted">Ativo</label>
        <button type="button" onClick={() => setAtivo(a => !a)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${ativo ? 'bg-fresh' : 'bg-surface-hover'}`}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-ink transition-transform ${ativo ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {error && <p className="text-sm text-alert-bright">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="rounded-lg bg-ember px-4 py-2 text-sm font-semibold text-ember-ink hover:bg-ember-hover disabled:opacity-50 transition-colors">
          {saving ? 'Salvando...' : initial ? 'Salvar alterações' : 'Criar produto'}
        </button>
        <button type="button" onClick={() => router.push('/cadastros/produtos')}
          className="rounded-lg border border-edge-strong px-4 py-2 text-sm text-ink-muted hover:text-ink transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  )
}
