'use client'

import { useState } from 'react'
import { Trash2, Plus, GripVertical } from 'lucide-react'

const TIPO_RESPOSTA_OPTIONS = [
  { value: 'sim_nao', label: 'Sim / Não' },
  { value: 'texto', label: 'Texto livre' },
  { value: 'selecao', label: 'Seleção' },
  { value: 'checklist_multiplo', label: 'Checklist múltiplo' },
  { value: 'data', label: 'Data' },
  { value: 'assinatura', label: 'Assinatura' },
]

const TIPO_RESPOSTA_LABEL: Record<string, string> = {
  sim_nao: 'Sim / Não',
  data: 'Data',
  selecao: 'Seleção',
  checklist_multiplo: 'Checklist múltiplo',
  assinatura: 'Assinatura',
  texto: 'Texto livre',
}

type Item = {
  id: string
  titulo: string
  descricao: string | null
  tipo_resposta: string
  opcoes: string[] | null
  ordem: number
}

type Props = {
  templateId: string
  initialItems: Item[]
}

export function EditarClient({ templateId, initialItems }: Props) {
  const [items, setItems] = useState<Item[]>(initialItems)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [tipoResposta, setTipoResposta] = useState('sim_nao')
  const [opcoesStr, setOpcoesStr] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  const needsOpcoes = tipoResposta === 'selecao' || tipoResposta === 'checklist_multiplo'

  async function handleRemover(itemId: string) {
    setRemovingId(itemId)
    try {
      const res = await fetch(`/api/checklists/${templateId}/items/${itemId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        alert(`Erro: ${data.error}`)
        return
      }
      setItems(prev => prev.filter(i => i.id !== itemId))
    } catch {
      alert('Erro ao remover item.')
    } finally {
      setRemovingId(null)
    }
  }

  async function handleAdicionar(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim()) return
    setAdding(true)
    setAddError('')

    const opcoes = needsOpcoes
      ? opcoesStr.split(',').map(s => s.trim()).filter(Boolean)
      : null

    try {
      const res = await fetch(`/api/checklists/${templateId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          tipo_resposta: tipoResposta,
          opcoes: opcoes && opcoes.length > 0 ? opcoes : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAddError(data.error || 'Erro ao adicionar item.')
        return
      }
      setItems(prev => [...prev, data.item])
      setTitulo('')
      setDescricao('')
      setOpcoesStr('')
      setTipoResposta('sim_nao')
    } catch {
      setAddError('Erro ao adicionar item.')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Lista de itens */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-800">
          <span className="text-sm font-semibold text-white">{items.length} {items.length === 1 ? 'item' : 'itens'}</span>
        </div>

        {items.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-neutral-500">
            Nenhum item. Adicione o primeiro abaixo.
          </div>
        ) : (
          <div className="divide-y divide-neutral-800/60">
            {items.map(item => (
              <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-neutral-700" />
                <span className="mt-0.5 min-w-[1.5rem] text-right text-xs font-mono text-neutral-600">{item.ordem}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium">{item.titulo}</p>
                  {item.descricao && (
                    <p className="text-xs text-neutral-500 mt-0.5">{item.descricao}</p>
                  )}
                  {item.opcoes && item.opcoes.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {item.opcoes.map((op, i) => (
                        <span key={i} className="rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-400">{op}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-neutral-800 text-neutral-400">
                    {TIPO_RESPOSTA_LABEL[item.tipo_resposta] ?? item.tipo_resposta}
                  </span>
                  <button
                    onClick={() => handleRemover(item.id)}
                    disabled={removingId === item.id}
                    className="flex h-7 w-7 items-center justify-center rounded text-neutral-600 hover:bg-red-900/30 hover:text-red-400 transition-colors disabled:opacity-40"
                    aria-label="Remover item"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Formulário novo item */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900">
        <div className="border-b border-neutral-800 px-5 py-4">
          <p className="text-sm font-semibold text-white flex items-center gap-2">
            <Plus className="h-4 w-4 text-emerald-400" />
            Adicionar item
          </p>
        </div>
        <form onSubmit={handleAdicionar} className="p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-neutral-400 mb-1">Título *</label>
              <input
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                placeholder="ex: Temperatura do freezer verificada"
                required
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-neutral-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">Tipo de resposta *</label>
              <select
                value={tipoResposta}
                onChange={e => { setTipoResposta(e.target.value); setOpcoesStr('') }}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:outline-none"
              >
                {TIPO_RESPOSTA_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">Descrição (opcional)</label>
              <input
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                placeholder="Instrução adicional"
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-neutral-500 focus:outline-none"
              />
            </div>

            {needsOpcoes && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-neutral-400 mb-1">
                  Opções <span className="text-neutral-600">(separadas por vírgula)</span>
                </label>
                <input
                  value={opcoesStr}
                  onChange={e => setOpcoesStr(e.target.value)}
                  placeholder="ex: Conforme, Não conforme, N/A"
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-neutral-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {addError && <p className="text-sm text-red-400">{addError}</p>}

          <button
            type="submit"
            disabled={adding || !titulo.trim()}
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-100 disabled:opacity-40 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {adding ? 'Adicionando...' : 'Adicionar item'}
          </button>
        </form>
      </div>
    </div>
  )
}
