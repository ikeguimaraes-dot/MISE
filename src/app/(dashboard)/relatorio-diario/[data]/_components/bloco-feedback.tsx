'use client'
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { FEEDBACK_CATEGORIAS, type FeedbackCategoria } from '@/app/api/relatorio-diario/_schema'
import { RegistroColapsavel } from './registro-colapsavel'

type FeedbackItem = { id: string; tipo: string; produto: string | null; categoria: string | null; descricao: string | null }

export function BlocoFeedback({
  tipo,
  relatorioData,
  unitId,
  disabled,
  itensIniciais,
}: {
  tipo: 'elogio' | 'reclamacao'
  relatorioData: string
  unitId: string
  disabled?: boolean
  itensIniciais?: FeedbackItem[]
}) {
  const [itens, setItens] = useState<FeedbackItem[]>(itensIniciais ?? [])
  const [produto, setProduto] = useState('')
  const [categoria, setCategoria] = useState<FeedbackCategoria | ''>('')
  const [descricao, setDescricao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const titulo = tipo === 'elogio' ? 'Elogios' : 'Reclamações'

  async function adicionar() {
    setSalvando(true); setErro('')
    const res = await fetch(`/api/relatorio-diario/${relatorioData}/registros/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit_id: unitId, tipo, produto: produto || null, categoria: categoria || null, descricao: descricao || null }),
    })
    if (res.ok) {
      const item = await res.json()
      setItens(prev => [...prev, item])
      setProduto(''); setCategoria(''); setDescricao('')
    } else {
      const { error } = await res.json()
      setErro(error ?? 'Erro ao adicionar.')
    }
    setSalvando(false)
  }

  async function remover(id: string) {
    const res = await fetch(
      `/api/relatorio-diario/${relatorioData}/registros/feedback?unit_id=${unitId}&id=${id}`,
      { method: 'DELETE' }
    )
    if (res.ok) setItens(prev => prev.filter(i => i.id !== id))
  }

  return (
    <RegistroColapsavel titulo={titulo} count={itens.length}>
      {itens.map(item => (
        <div key={item.id} className="flex items-start justify-between rounded-lg border border-edge bg-base px-3 py-2 gap-2">
          <div className="min-w-0">
            {item.produto && <p className="text-sm font-medium text-ink truncate">{item.produto}</p>}
            {item.categoria && <p className="text-xs text-ink-muted">{item.categoria}</p>}
            {item.descricao && <p className="text-xs text-ink-subtle mt-0.5 line-clamp-2">{item.descricao}</p>}
          </div>
          {!disabled && (
            <button onClick={() => remover(item.id)} className="shrink-0 text-ink-faint hover:text-alert transition-colors mt-0.5">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}

      {!disabled && (
        <div className="space-y-2 pt-1">
          <input
            type="text" value={produto} onChange={e => setProduto(e.target.value)}
            placeholder="Produto (opcional)"
            className="w-full rounded-lg border border-edge bg-base px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-ember focus:outline-none"
          />
          <select
            value={categoria} onChange={e => setCategoria(e.target.value as FeedbackCategoria | '')}
            className="w-full rounded-lg border border-edge bg-base px-3 py-2 text-sm text-ink focus:border-ember focus:outline-none"
          >
            <option value="">Categoria (opcional)…</option>
            {FEEDBACK_CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <textarea
            value={descricao} onChange={e => setDescricao(e.target.value)}
            placeholder="Descrição (opcional)…" rows={2}
            className="w-full rounded-lg border border-edge bg-base px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-ember focus:outline-none resize-none"
          />
          {erro && <p className="text-xs text-alert-bright">{erro}</p>}
          <button
            onClick={adicionar} disabled={salvando}
            className="w-full rounded-lg bg-surface-raised border border-edge px-3 py-2 text-sm font-medium text-ink hover:bg-surface transition-colors disabled:opacity-50"
          >
            {salvando ? 'Adicionando…' : `+ Adicionar ${tipo === 'elogio' ? 'elogio' : 'reclamação'}`}
          </button>
        </div>
      )}
    </RegistroColapsavel>
  )
}
