'use client'

import { useState, useCallback, createContext, useContext } from 'react'
import {
  DndContext, DragOverlay, closestCenter,
  PointerSensor, KeyboardSensor,
  useSensor, useSensors,
  type DragStartEvent, type DragEndEvent, type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Pencil, Trash2, Check, X, AlertTriangle } from 'lucide-react'

// ── types ─────────────────────────────────────────────────────────────────────

type Topico = { key: string; nome: string; peso: number }

const EquipmentEditorContext=createContext(false)

type Item = {
  por_equipamento:boolean; equipamento_tipo:string

  id: string; key: string; titulo: string; descricao: string | null
  tipo_resposta: string; opcoes: string[] | null
  peso: number; critico: boolean; topico_key: string | null
  criterio_regramento: string | null; requer_foto: string | null
}

type IEdit = {
  por_equipamento:boolean; equipamento_tipo:string

  titulo: string; descricao: string; tipo_resposta: string
  opcoes_str: string; peso: string; critico: boolean
  criterio_regramento: string; requer_foto: string
}

type TEdit = { nome: string; peso: string }

type Props = {
  templateId: string; modulo: string
  initialItems: Record<string, unknown>[]
  initialTopicos: { topico_ordem: number; topico_nome: string | null; peso: unknown }[]
}

// ── constants ─────────────────────────────────────────────────────────────────

const TIPOS = [
  { value: 'sim_nao', label: 'Sim / Não' },
  { value: 'texto', label: 'Texto livre' },
  { value: 'selecao', label: 'Seleção' },
  { value: 'checklist_multiplo', label: 'Checklist múltiplo' },
  { value: 'data', label: 'Data' },
  { value: 'assinatura', label: 'Assinatura' },
]

const TIPO_LABEL: Record<string, string> = {
  sim_nao: 'Sim/Não', data: 'Data', selecao: 'Seleção',
  checklist_multiplo: 'Checklist', assinatura: 'Assinatura', texto: 'Texto',
}

const IC = 'w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:border-ink-subtle focus:outline-none'

const DEFI: IEdit = {
  titulo: '', descricao: '', tipo_resposta: 'sim_nao', opcoes_str: '',
  peso: '1', critico: false, por_equipamento:false,equipamento_tipo:'', criterio_regramento: '', requer_foto: 'nao',
}

// ── helpers ───────────────────────────────────────────────────────────────────

let _k = 0
const uid = () => `k${++_k}`

function hasOpts(tipo: string) {
  return tipo === 'selecao' || tipo === 'checklist_multiplo'
}

function containerOf(itemKey: string, byKey: Map<string | null, Item[]>): string | null {
  for (const [key, arr] of byKey) {
    if (arr.some(i => i.key === itemKey)) return key
  }
  return null
}

function buildPayload(tops: Topico[], byKey: Map<string | null, Item[]>) {
  let ord = 1
  const itens: { id: string; ordem: number; topico_ordem: number | null; topico_nome: string | null }[] = []
  for (const item of (byKey.get(null) ?? [])) {
    itens.push({ id: item.id, ordem: ord++, topico_ordem: null, topico_nome: null })
  }
  tops.forEach((t, i) => {
    for (const item of (byKey.get(t.key) ?? [])) {
      itens.push({ id: item.id, ordem: ord++, topico_ordem: i + 1, topico_nome: t.nome })
    }
  })
  return {
    topicos: tops.map((t, i) => ({ topico_ordem: i + 1, topico_nome: t.nome, peso: t.peso })),
    itens,
  }
}

function initState(
  rawItems: Record<string, unknown>[],
  rawTopicos: { topico_ordem: number; topico_nome: string | null; peso: unknown }[]
) {
  const tops: Topico[] = rawTopicos.map(t => ({
    key: uid(), nome: t.topico_nome ?? '', peso: Number(t.peso ?? 0),
  }))
  const ordToKey = new Map(rawTopicos.map((t, i) => [t.topico_ordem, tops[i].key]))
  const byKey = new Map<string | null, Item[]>([[null, []]])
  for (const t of tops) byKey.set(t.key, [])

  for (const r of rawItems) {
    const tOrd = r.topico_ordem as number | null
    const tKey = tOrd != null ? (ordToKey.get(tOrd) ?? null) : null
    const item: Item = {
      id: r.id as string, key: uid(),
      titulo: r.titulo as string,
      descricao: (r.descricao as string | null) ?? null,
      tipo_resposta: (r.tipo_resposta as string) ?? 'sim_nao',
      opcoes: Array.isArray(r.opcoes) ? (r.opcoes as string[]) : null,
      peso: Number(r.peso ?? 1),
      critico: Boolean(r.critico ?? false),por_equipamento:Boolean(r.por_equipamento),equipamento_tipo:String(r.equipamento_tipo??''),
      topico_key: tKey,
      criterio_regramento: (r.criterio_regramento as string | null) ?? null,
      requer_foto: (r.requer_foto as string | null) ?? 'nao',
    }
    ;(byKey.get(tKey) ?? byKey.get(null)!).push(item)
  }
  return { tops, byKey }
}

// ── ItemEditForm ──────────────────────────────────────────────────────────────

function ItemEditForm({ state, onChange, onSave, onCancel, saving }: {
  state: IEdit
  onChange: (p: Partial<IEdit>) => void
  onSave: () => void; onCancel: () => void; saving: boolean
}) {
  const isCrivo=useContext(EquipmentEditorContext)
  return (
    <div className="px-4 py-4 bg-surface-raised/40 space-y-3 border-b border-edge/60">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-ink-muted mb-1">Título</label>
          <input value={state.titulo} onChange={e => onChange({ titulo: e.target.value })} className={IC} autoFocus />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Tipo</label>
          <select value={state.tipo_resposta} onChange={e => onChange({ tipo_resposta: e.target.value, opcoes_str: '' })} className={IC}>
            {TIPOS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Descrição</label>
          <input value={state.descricao} onChange={e => onChange({ descricao: e.target.value })} placeholder="Instrução adicional" className={IC} />
        </div>
        {hasOpts(state.tipo_resposta) && (
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-ink-muted mb-1">Opções <span className="text-ink-faint">(vírgula)</span></label>
            <input value={state.opcoes_str} onChange={e => onChange({ opcoes_str: e.target.value })} className={IC} />
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-ink-muted mb-1">Critério / Regramento</label>
          <textarea rows={2} value={state.criterio_regramento} onChange={e => onChange({ criterio_regramento: e.target.value })} className={`${IC} resize-none`} />
        </div>
        <div className="flex items-center gap-4 flex-wrap sm:col-span-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-ink-muted">Peso</span>
            <input type="number" min={0} step={0.01} value={state.peso} onChange={e => onChange({ peso: e.target.value })} className="w-20 rounded-lg border border-edge-strong bg-surface-raised px-2 py-2 text-sm text-ink text-center focus:outline-none" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-ink-muted">Foto?</span>
            {(['nao', 'sim'] as const).map(v => (
              <button key={v} type="button" onClick={() => onChange({ requer_foto: v })} className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${state.requer_foto === v ? 'bg-ember text-white' : 'border border-edge text-ink-muted hover:text-ink'}`}>{v === 'sim' ? 'Sim' : 'Não'}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-ink-muted">Crítico</span>
            <button type="button" onClick={() => onChange({ critico: !state.critico })} className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${state.critico ? 'bg-alert text-white' : 'border border-edge text-ink-muted hover:text-ink'}`}>{state.critico ? 'Sim' : 'Não'}</button>
          </div>
        </div>
        {isCrivo&&<div className="sm:col-span-2 space-y-3 rounded-lg border border-edge p-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={state.por_equipamento} onChange={e=>onChange({por_equipamento:e.target.checked})}/>Repetir por equipamento ativo do local</label>{state.por_equipamento&&<label className="block text-sm">Tipo de equipamento<input className={IC} required value={state.equipamento_tipo} onChange={e=>onChange({equipamento_tipo:e.target.value})} maxLength={200}/><span className="text-xs text-ink-muted">Use o mesmo tipo do cadastro. O peso será dividido entre os equipamentos.</span></label>}</div>}
        {state.critico && (
          <div className="sm:col-span-2 flex items-center gap-2 rounded-lg bg-alert/10 border border-alert/30 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-alert-bright shrink-0" />
            <p className="text-xs text-alert-bright">Resposta "Não" zerará o tópico inteiro na nota.</p>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button onClick={onSave} disabled={saving || !state.titulo.trim()} className="flex items-center gap-1.5 rounded-lg bg-ember px-3 py-1.5 text-xs font-semibold text-ember-ink hover:bg-ember-hover disabled:opacity-40 transition-colors">
          <Check className="h-3.5 w-3.5" />{saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button onClick={onCancel} className="flex items-center gap-1.5 rounded-lg border border-edge-strong px-3 py-1.5 text-xs text-ink-muted hover:text-ink transition-colors">
          <X className="h-3.5 w-3.5" />Cancelar
        </button>
      </div>
    </div>
  )
}

// ── SortableItem ──────────────────────────────────────────────────────────────

function SortableItem({ item, idx, topicIdx, onEdit, onDelete, onMove, topicos }: {
  item: Item; idx: number; topicIdx: number | null
  onEdit: () => void; onDelete: () => void
  onMove?: (toKey: string) => void; topicos: Topico[]
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `i:${item.key}` })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const label = topicIdx != null ? `${topicIdx}.${idx}` : `${idx}`

  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex items-start gap-2 px-3 py-2.5">
        <button {...listeners} {...attributes} type="button" className="mt-0.5 shrink-0 cursor-grab active:cursor-grabbing text-ink-faint hover:text-ink-muted touch-none" tabIndex={-1}>
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <span className="mt-0.5 w-8 text-right text-[11px] font-mono text-ink-faint shrink-0">{label}.</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-ink leading-snug">{item.titulo}</p>
          {item.descricao && <p className="text-xs text-ink-subtle mt-0.5">{item.descricao}</p>}
          {item.critico && (
            <span className="inline-flex items-center gap-0.5 rounded bg-alert/15 border border-alert/30 px-1.5 py-0.5 text-[10px] font-bold text-alert-bright mt-1">✱ Crítico</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {item.topico_key === null && topicos.length > 0 && onMove && (
            <select onChange={e => { if (e.target.value) onMove(e.target.value) }} className="rounded border border-edge bg-surface text-xs text-ink-muted px-1.5 py-1 focus:outline-none cursor-pointer" defaultValue="">
              <option value="" disabled>Mover para...</option>
              {topicos.map(t => <option key={t.key} value={t.key}>{t.nome}</option>)}
            </select>
          )}
          <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-surface-raised text-ink-muted">{TIPO_LABEL[item.tipo_resposta] ?? item.tipo_resposta}</span>
          {item.peso > 0 && <span className="text-[10px] text-ink-faint">p{item.peso}</span>}
          <button onClick={onEdit} className="flex h-7 w-7 items-center justify-center rounded text-ink-faint hover:bg-surface-raised hover:text-ink transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
          <button onClick={onDelete} className="flex h-7 w-7 items-center justify-center rounded text-ink-faint hover:bg-alert-soft hover:text-alert-bright transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </div>
  )
}

// ── SortableTopico ────────────────────────────────────────────────────────────

function SortableTopico({
  topico, topicIdx, items, topicos,
  editingItemKey, itemEditState, onItemEditChange, onSaveItem, itemSaving, onCancelItemEdit,
  onEditItem, onDeleteItem, onMoveItem,
  onEditTopico, editingTopico, topicoEditState, onTopicoEditChange, onSaveTopico, topicoSaving, onCancelTopicoEdit,
  onDeleteTopico,
  addingHere, addItemState, onAddItemChange, onSaveAddItem, addItemSaving, onCancelAddItem, onOpenAddItem,
}: {
  topico: Topico; topicIdx: number; items: Item[]; topicos: Topico[]
  editingItemKey: string | null
  itemEditState: IEdit | null
  onItemEditChange: (p: Partial<IEdit>) => void
  onSaveItem: (key: string) => void
  itemSaving: boolean
  onCancelItemEdit: () => void
  onEditItem: (key: string) => void
  onDeleteItem: (key: string) => void
  onMoveItem?: (key: string, toKey: string) => void
  onEditTopico: () => void
  editingTopico: boolean
  topicoEditState: TEdit | null
  onTopicoEditChange: (p: Partial<TEdit>) => void
  onSaveTopico: () => void
  topicoSaving: boolean
  onCancelTopicoEdit: () => void
  onDeleteTopico: () => void
  addingHere: boolean
  addItemState: IEdit
  onAddItemChange: (p: Partial<IEdit>) => void
  onSaveAddItem: () => void
  addItemSaving: boolean
  onCancelAddItem: () => void
  onOpenAddItem: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `t:${topico.key}` })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const itemIds = items.map(i => `i:${i.key}`)

  return (
    <div ref={setNodeRef} style={style} className={`rounded-xl border bg-surface overflow-hidden transition-shadow ${isDragging ? 'border-ember/50 shadow-lg opacity-60' : 'border-edge'}`}>
      {/* Topic header */}
      {editingTopico && topicoEditState ? (
        <div className="px-3 py-3 border-b border-edge/60 bg-surface-raised/50 space-y-2">
          <div className="flex gap-2">
            <input
              value={topicoEditState.nome}
              onChange={e => onTopicoEditChange({ nome: e.target.value })}
              placeholder="Nome do tópico"
              className="flex-1 rounded-lg border border-edge-strong bg-surface-raised px-3 py-1.5 text-sm text-ink focus:outline-none"
              autoFocus
            />
            <input
              type="number" min={0} step={0.01}
              value={topicoEditState.peso}
              onChange={e => onTopicoEditChange({ peso: e.target.value })}
              className="w-20 rounded-lg border border-edge-strong bg-surface-raised px-2 py-1.5 text-sm text-ink text-center focus:outline-none"
              placeholder="Peso"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={onSaveTopico} disabled={topicoSaving || !topicoEditState.nome.trim()} className="flex items-center gap-1.5 rounded-lg bg-ember px-3 py-1.5 text-xs font-semibold text-ember-ink hover:bg-ember-hover disabled:opacity-40 transition-colors">
              <Check className="h-3 w-3" />{topicoSaving ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={onCancelTopicoEdit} className="flex items-center gap-1.5 rounded-lg border border-edge-strong px-3 py-1.5 text-xs text-ink-muted hover:text-ink transition-colors">
              <X className="h-3 w-3" />Cancelar
            </button>
            <button onClick={onDeleteTopico} className="ml-auto flex items-center gap-1.5 rounded-lg border border-alert/30 px-3 py-1.5 text-xs text-alert-bright hover:bg-alert-soft transition-colors">
              <Trash2 className="h-3 w-3" />Excluir tópico
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-edge/60 bg-surface-raised/30">
          <button {...listeners} {...attributes} type="button" className="shrink-0 cursor-grab active:cursor-grabbing text-ink-faint hover:text-ink-muted touch-none" tabIndex={-1}>
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="text-xs font-bold text-ink-muted uppercase tracking-wide">{topicIdx}.</span>
          <span className="flex-1 text-sm font-semibold text-ink truncate">{topico.nome || <span className="italic text-ink-faint">Sem nome</span>}</span>
          <span className="text-xs text-ink-faint">peso {topico.peso}</span>
          <span className="text-xs text-ink-faint">({items.length} {items.length === 1 ? 'item' : 'itens'})</span>
          <button onClick={onEditTopico} className="flex h-6 w-6 items-center justify-center rounded text-ink-faint hover:bg-surface-raised hover:text-ink transition-colors">
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Items */}
      <div className="divide-y divide-edge/40 min-h-[2px]">
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          {items.map((item, idx) => (
            <div key={item.key}>
              {editingItemKey === item.key && itemEditState ? (
                <ItemEditForm
                  state={itemEditState}
                  onChange={onItemEditChange}
                  onSave={() => onSaveItem(item.key)}
                  onCancel={onCancelItemEdit}
                  saving={itemSaving}
                />
              ) : (
                <SortableItem
                  item={item} idx={idx + 1} topicIdx={topicIdx}
                  onEdit={() => onEditItem(item.key)}
                  onDelete={() => onDeleteItem(item.key)}
                  topicos={topicos}
                />
              )}
            </div>
          ))}
        </SortableContext>
      </div>

      {/* Add item to this topic */}
      {addingHere ? (
        <div className="border-t border-edge/40">
          <ItemEditForm
            state={addItemState}
            onChange={onAddItemChange}
            onSave={onSaveAddItem}
            onCancel={onCancelAddItem}
            saving={addItemSaving}
          />
        </div>
      ) : (
        <div className="px-3 py-2 border-t border-edge/40">
          <button onClick={onOpenAddItem} className="flex items-center gap-1.5 text-xs text-ink-faint hover:text-ink transition-colors">
            <Plus className="h-3.5 w-3.5" />Adicionar subtópico
          </button>
        </div>
      )}
    </div>
  )
}

// ── EditarClient ──────────────────────────────────────────────────────────────

export function EditarClient({ templateId, modulo, initialItems, initialTopicos }: Props) {
  const [initData] = useState(() => initState(initialItems, initialTopicos))
  const [topicos, setTopicos] = useState<Topico[]>(initData.tops)
  const [byKey, setByKey] = useState<Map<string | null, Item[]>>(initData.byKey)

  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingItemKey, setEditingItemKey] = useState<string | null>(null)
  const [itemEditState, setItemEditState] = useState<IEdit | null>(null)
  const [editingTopicoKey, setEditingTopicoKey] = useState<string | null>(null)
  const [topicoEditState, setTopicoEditState] = useState<TEdit | null>(null)
  const [addingToTopicoKey, setAddingToTopicoKey] = useState<string | null | undefined>(undefined)
  const [addItemState, setAddItemState] = useState<IEdit>({ ...DEFI })
  const [addingTopico, setAddingTopico] = useState(false)
  const [addTopicoState, setAddTopicoState] = useState<TEdit>({ nome: '', peso: '0' })

  const [reorderSaving, setReorderSaving] = useState(false)
  const [itemSaving, setItemSaving] = useState(false)
  const [addItemSaving, setAddItemSaving] = useState(false)
  const [addTopicoSaving, setAddTopicoSaving] = useState(false)
  const [topicoSaving, setTopicoSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // ── API helpers ──

  const saveReorder = useCallback(async (tops: Topico[], map: Map<string | null, Item[]>) => {
    setReorderSaving(true)
    try {
      await fetch(`/api/checklists/${templateId}/reordenar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(tops, map)),
      })
    } finally {
      setReorderSaving(false)
    }
  }, [templateId])

  function startEditItem(itemKey: string) {
    for (const items of byKey.values()) {
      const found = items.find(i => i.key === itemKey)
      if (found) {
        setEditingItemKey(itemKey)
        setItemEditState({
          titulo: found.titulo,
          descricao: found.descricao ?? '',
          tipo_resposta: found.tipo_resposta,
          opcoes_str: found.opcoes?.join(', ') ?? '',
          peso: String(found.peso),
          critico: found.critico,por_equipamento:found.por_equipamento,equipamento_tipo:found.equipamento_tipo,
          criterio_regramento: found.criterio_regramento ?? '',
          requer_foto: found.requer_foto ?? 'nao',
        })
        return
      }
    }
  }

  async function handleSaveItem(itemKey: string) {
    if (!itemEditState || !itemEditState.titulo.trim()) return
    let itemId = ''
    for (const items of byKey.values()) {
      const found = items.find(i => i.key === itemKey)
      if (found) { itemId = found.id; break }
    }
    if (!itemId) return
    setItemSaving(true)
    const opcoes = hasOpts(itemEditState.tipo_resposta)
      ? itemEditState.opcoes_str.split(',').map(s => s.trim()).filter(Boolean)
      : null
    try {
      const res = await fetch(`/api/checklists/${templateId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: itemEditState.titulo.trim(),
          descricao: itemEditState.descricao.trim() || null,
          tipo_resposta: itemEditState.tipo_resposta,
          opcoes: opcoes && opcoes.length > 0 ? opcoes : null,
          criterio_regramento: itemEditState.criterio_regramento.trim() || null,
          requer_foto: itemEditState.requer_foto,
          peso: parseFloat(itemEditState.peso) || 0,
          critico: itemEditState.critico,por_equipamento:modulo==='CRIVO'&&itemEditState.por_equipamento,equipamento_tipo:itemEditState.por_equipamento?itemEditState.equipamento_tipo.trim():null,
        }),
      })
      if (!res.ok) { alert('Erro ao salvar item.'); return }
      const { item: saved } = await res.json()
      setByKey(prev => {
        const next = new Map(prev)
        for (const [k, arr] of next) {
          const idx = arr.findIndex(i => i.key === itemKey)
          if (idx >= 0) {
            const updated = [...arr]
            updated[idx] = {
              ...updated[idx],
              titulo: saved.titulo, descricao: saved.descricao,
              tipo_resposta: saved.tipo_resposta, opcoes: saved.opcoes,
              criterio_regramento: saved.criterio_regramento,
              requer_foto: saved.requer_foto,
              peso: Number(saved.peso ?? 1), critico: Boolean(saved.critico),por_equipamento:Boolean(saved.por_equipamento),equipamento_tipo:String(saved.equipamento_tipo??''),
            }
            next.set(k, updated)
            break
          }
        }
        return next
      })
      setEditingItemKey(null)
      setItemEditState(null)
    } finally {
      setItemSaving(false)
    }
  }

  async function handleDeleteItem(itemKey: string) {
    let itemId = ''
    let srcKey: string | null = null
    for (const [k, arr] of byKey) {
      const found = arr.find(i => i.key === itemKey)
      if (found) { itemId = found.id; srcKey = k; break }
    }
    if (!itemId) return
    const res = await fetch(`/api/checklists/${templateId}/items/${itemId}`, { method: 'DELETE' })
    if (!res.ok) { alert('Erro ao remover item.'); return }
    setByKey(prev => {
      const next = new Map(prev)
      next.set(srcKey, (next.get(srcKey) ?? []).filter(i => i.key !== itemKey))
      return next
    })
  }

  function handleMoveItem(itemKey: string, toTopicoKey: string) {
    setByKey(prev => {
      let movedItem: Item | null = null
      const next = new Map(prev)
      for (const [k, arr] of next) {
        const idx = arr.findIndex(i => i.key === itemKey)
        if (idx >= 0) {
          movedItem = { ...arr[idx], topico_key: toTopicoKey }
          next.set(k, arr.filter(i => i.key !== itemKey))
          break
        }
      }
      if (movedItem) {
        next.set(toTopicoKey, [...(next.get(toTopicoKey) ?? []), movedItem])
      }
      void saveReorder(topicos, next)
      return next
    })
  }

  async function handleAddItem(topicoKey: string | null) {
    if (!addItemState.titulo.trim()) return
    setAddItemSaving(true)

    const topico = topicoKey !== null ? topicos.find(t => t.key === topicoKey) : null
    const topicoIdx = topico ? topicos.indexOf(topico) + 1 : null
    const opcoes = hasOpts(addItemState.tipo_resposta)
      ? addItemState.opcoes_str.split(',').map(s => s.trim()).filter(Boolean)
      : null

    try {
      const res = await fetch(`/api/checklists/${templateId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: addItemState.titulo.trim(),
          descricao: addItemState.descricao.trim() || null,
          tipo_resposta: addItemState.tipo_resposta,
          opcoes: opcoes && opcoes.length > 0 ? opcoes : null,
          criterio_regramento: addItemState.criterio_regramento.trim() || null,
          requer_foto: addItemState.requer_foto,
          peso: parseFloat(addItemState.peso) || 1,
          critico: addItemState.critico,por_equipamento:modulo==='CRIVO'&&addItemState.por_equipamento,equipamento_tipo:addItemState.por_equipamento?addItemState.equipamento_tipo.trim():null,
          topico_ordem: topicoIdx,
          topico_nome: topico?.nome ?? null,
        }),
      })
      if (!res.ok) { alert('Erro ao adicionar item.'); return }
      const { item: saved } = await res.json()
      const newItem: Item = {
        id: saved.id, key: uid(),
        titulo: saved.titulo, descricao: saved.descricao,
        tipo_resposta: saved.tipo_resposta, opcoes: saved.opcoes,
        peso: Number(saved.peso ?? 1), critico: Boolean(saved.critico),por_equipamento:Boolean(saved.por_equipamento),equipamento_tipo:String(saved.equipamento_tipo??''),
        topico_key: topicoKey,
        criterio_regramento: saved.criterio_regramento,
        requer_foto: saved.requer_foto,
      }
      setByKey(prev => {
        const next = new Map(prev)
        next.set(topicoKey, [...(next.get(topicoKey) ?? []), newItem])
        return next
      })
      setAddingToTopicoKey(undefined)
      setAddItemState({ ...DEFI })
    } finally {
      setAddItemSaving(false)
    }
  }

  async function handleAddTopico() {
    if (!addTopicoState.nome.trim()) return
    setAddTopicoSaving(true)
    try {
      const res = await fetch(`/api/checklists/${templateId}/topicos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topico_nome: addTopicoState.nome.trim(), peso: parseFloat(addTopicoState.peso) || 0 }),
      })
      if (!res.ok) { alert('Erro ao criar tópico.'); return }
      const newTopico: Topico = { key: uid(), nome: addTopicoState.nome.trim(), peso: parseFloat(addTopicoState.peso) || 0 }
      setTopicos(prev => [...prev, newTopico])
      setByKey(prev => { const next = new Map(prev); next.set(newTopico.key, []); return next })
      setAddingTopico(false)
      setAddTopicoState({ nome: '', peso: '0' })
    } finally {
      setAddTopicoSaving(false)
    }
  }

  async function handleSaveTopico(topicoKey: string) {
    if (!topicoEditState?.nome.trim()) return
    setTopicoSaving(true)
    const newNome = topicoEditState.nome.trim()
    const newPeso = parseFloat(topicoEditState.peso) || 0
    const newTopicos = topicos.map(t => t.key === topicoKey ? { ...t, nome: newNome, peso: newPeso } : t)
    // Update topico_nome in items for this topic
    setByKey(prev => {
      const next = new Map(prev)
      const arr = (next.get(topicoKey) ?? []).map(i => ({ ...i }))
      next.set(topicoKey, arr)
      return next
    })
    setTopicos(newTopicos)
    setEditingTopicoKey(null)
    setTopicoEditState(null)
    try {
      await saveReorder(newTopicos, byKey)
    } finally {
      setTopicoSaving(false)
    }
  }

  async function handleDeleteTopico(topicoKey: string) {
    if (!confirm('Excluir este tópico? Os itens dentro dele ficarão sem tópico.')) return
    const items = byKey.get(topicoKey) ?? []
    const newTopicos = topicos.filter(t => t.key !== topicoKey)
    setTopicos(newTopicos)
    setByKey(prev => {
      const next = new Map(prev)
      // Move items to null group
      const nullItems = [...(next.get(null) ?? []), ...items.map(i => ({ ...i, topico_key: null }))]
      next.set(null, nullItems)
      next.delete(topicoKey)
      return next
    })
    setEditingTopicoKey(null)
    setTopicoEditState(null)
    await saveReorder(newTopicos, new Map([
      [null, [...(byKey.get(null) ?? []), ...items.map(i => ({ ...i, topico_key: null }))]],
      ...newTopicos.map(t => [t.key, byKey.get(t.key) ?? []] as [string, Item[]]),
    ]))
  }

  // ── DnD handlers ──

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id))
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    const aId = String(active.id)
    if (!aId.startsWith('i:') || !over) return

    const oId = String(over.id)
    const activeKey = aId.slice(2)
    const src = containerOf(activeKey, byKey)

    let dst: string | null = null
    if (oId.startsWith('t:')) {
      dst = oId === 't:__null__' ? null : oId.slice(2)
    } else if (oId.startsWith('i:')) {
      dst = containerOf(oId.slice(2), byKey)
    }

    if (dst === src) return

    setByKey(prev => {
      const next = new Map(prev)
      const srcArr = [...(next.get(src) ?? [])]
      const dstArr = [...(next.get(dst) ?? [])]
      const aIdx = srcArr.findIndex(i => i.key === activeKey)
      if (aIdx === -1) return prev
      const [moved] = srcArr.splice(aIdx, 1)
      const movedItem = { ...moved, topico_key: dst }

      if (oId.startsWith('i:')) {
        const overKey = oId.slice(2)
        const oIdx = dstArr.findIndex(i => i.key === overKey)
        dstArr.splice(oIdx >= 0 ? oIdx : dstArr.length, 0, movedItem)
      } else {
        dstArr.push(movedItem)
      }

      next.set(src, srcArr)
      next.set(dst, dstArr)
      return next
    })
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over || active.id === over.id) return

    const aId = String(active.id)
    const oId = String(over.id)

    if (aId.startsWith('t:') && oId.startsWith('t:')) {
      const aKey = aId.slice(2)
      const oKey = oId.slice(2)
      const oldIdx = topicos.findIndex(t => t.key === aKey)
      const newIdx = topicos.findIndex(t => t.key === oKey)
      if (oldIdx === -1 || newIdx === -1) return
      const newTopicos = arrayMove(topicos, oldIdx, newIdx)
      setTopicos(newTopicos)
      void saveReorder(newTopicos, byKey)
      return
    }

    if (aId.startsWith('i:') && oId.startsWith('i:')) {
      const aKey = aId.slice(2)
      const oKey = oId.slice(2)
      const src = containerOf(aKey, byKey)
      const dst = containerOf(oKey, byKey)

      if (src === dst) {
        setByKey(prev => {
          const next = new Map(prev)
          const arr = [...(next.get(src) ?? [])]
          const oldIdx = arr.findIndex(i => i.key === aKey)
          const newIdx = arr.findIndex(i => i.key === oKey)
          if (oldIdx === -1 || newIdx === -1) return prev
          next.set(src, arrayMove(arr, oldIdx, newIdx))
          void saveReorder(topicos, next)
          return next
        })
      } else {
        // Already moved by onDragOver — just save current state
        void saveReorder(topicos, byKey)
      }
      return
    }

    // Item dropped onto topic header (cross-container already handled by onDragOver)
    if (aId.startsWith('i:')) {
      void saveReorder(topicos, byKey)
    }
  }

  // ── Derived state ──

  const nullItems = byKey.get(null) ?? []
  const topicDndIds = topicos.map(t => `t:${t.key}`)
  const nullItemDndIds = nullItems.map(i => `i:${i.key}`)

  // Find active element for overlay
  let activeItem: Item | null = null
  let activeTopico: Topico | null = null
  if (activeId?.startsWith('i:')) {
    const k = activeId.slice(2)
    for (const arr of byKey.values()) {
      const f = arr.find(i => i.key === k)
      if (f) { activeItem = f; break }
    }
  } else if (activeId?.startsWith('t:')) {
    activeTopico = topicos.find(t => t.key === activeId.slice(2)) ?? null
  }

  const totalItems = Array.from(byKey.values()).reduce((s, a) => s + a.length, 0)

  return (
    <EquipmentEditorContext.Provider value={modulo==='CRIVO'}><div className="space-y-3">
      {reorderSaving && (
        <p className="text-xs text-ink-faint text-right animate-pulse">Salvando ordem...</p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {/* Sem tópico */}
        {(nullItems.length > 0 || topicos.length === 0) && (
          <div className="rounded-xl border border-edge bg-surface overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-edge/60 bg-surface-raised/20">
              <span className="flex-1 text-xs font-semibold text-ink-muted uppercase tracking-wide">Sem tópico</span>
              <span className="text-xs text-ink-faint">({nullItems.length} {nullItems.length === 1 ? 'item' : 'itens'})</span>
            </div>
            <div className="divide-y divide-edge/40 min-h-[2px]">
              <SortableContext items={nullItemDndIds} strategy={verticalListSortingStrategy}>
                {nullItems.map((item, idx) => (
                  <div key={item.key}>
                    {editingItemKey === item.key && itemEditState ? (
                      <ItemEditForm
                        state={itemEditState}
                        onChange={p => setItemEditState(s => s ? { ...s, ...p } : s)}
                        onSave={() => handleSaveItem(item.key)}
                        onCancel={() => { setEditingItemKey(null); setItemEditState(null) }}
                        saving={itemSaving}
                      />
                    ) : (
                      <SortableItem
                        item={item} idx={idx + 1} topicIdx={null}
                        onEdit={() => startEditItem(item.key)}
                        onDelete={() => handleDeleteItem(item.key)}
                        onMove={(toKey) => handleMoveItem(item.key, toKey)}
                        topicos={topicos}
                      />
                    )}
                  </div>
                ))}
              </SortableContext>
            </div>
            {addingToTopicoKey === null ? (
              <div className="border-t border-edge/40">
                <ItemEditForm
                  state={addItemState}
                  onChange={p => setAddItemState(s => ({ ...s, ...p }))}
                  onSave={() => handleAddItem(null)}
                  onCancel={() => { setAddingToTopicoKey(undefined); setAddItemState({ ...DEFI }) }}
                  saving={addItemSaving}
                />
              </div>
            ) : (
              <div className="px-3 py-2 border-t border-edge/40">
                <button onClick={() => { setAddingToTopicoKey(null); setAddItemState({ ...DEFI }) }} className="flex items-center gap-1.5 text-xs text-ink-faint hover:text-ink transition-colors">
                  <Plus className="h-3.5 w-3.5" />Adicionar item
                </button>
              </div>
            )}
          </div>
        )}

        {/* Topic sections */}
        <SortableContext items={topicDndIds} strategy={verticalListSortingStrategy}>
          {topicos.map((topico, i) => (
            <SortableTopico
              key={topico.key}
              topico={topico}
              topicIdx={i + 1}
              items={byKey.get(topico.key) ?? []}
              topicos={topicos}
              editingItemKey={editingItemKey}
              itemEditState={itemEditState}
              onItemEditChange={p => setItemEditState(s => s ? { ...s, ...p } : s)}
              onSaveItem={(key) => handleSaveItem(key)}
              itemSaving={itemSaving}
              onCancelItemEdit={() => { setEditingItemKey(null); setItemEditState(null) }}
              onEditItem={(key) => startEditItem(key)}
              onDeleteItem={(key) => handleDeleteItem(key)}
              onMoveItem={(key, toKey) => handleMoveItem(key, toKey)}
              onEditTopico={() => {
                setEditingTopicoKey(topico.key)
                setTopicoEditState({ nome: topico.nome, peso: String(topico.peso) })
              }}
              editingTopico={editingTopicoKey === topico.key}
              topicoEditState={editingTopicoKey === topico.key ? topicoEditState : null}
              onTopicoEditChange={p => setTopicoEditState(s => s ? { ...s, ...p } : s)}
              onSaveTopico={() => handleSaveTopico(topico.key)}
              topicoSaving={topicoSaving}
              onCancelTopicoEdit={() => { setEditingTopicoKey(null); setTopicoEditState(null) }}
              onDeleteTopico={() => handleDeleteTopico(topico.key)}
              addingHere={addingToTopicoKey === topico.key}
              addItemState={addItemState}
              onAddItemChange={p => setAddItemState(s => ({ ...s, ...p }))}
              onSaveAddItem={() => handleAddItem(topico.key)}
              addItemSaving={addItemSaving}
              onCancelAddItem={() => { setAddingToTopicoKey(undefined); setAddItemState({ ...DEFI }) }}
              onOpenAddItem={() => { setAddingToTopicoKey(topico.key); setAddItemState({ ...DEFI }) }}
            />
          ))}
        </SortableContext>

        <DragOverlay adjustScale={false}>
          {activeTopico && (
            <div className="rounded-xl border border-ember/50 bg-surface shadow-lg px-3 py-2.5 flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-ink-faint" />
              <span className="text-sm font-semibold text-ink">{activeTopico.nome}</span>
            </div>
          )}
          {activeItem && (
            <div className="rounded-lg border border-edge bg-surface shadow-md px-3 py-2.5 flex items-start gap-2">
              <GripVertical className="h-3.5 w-3.5 text-ink-faint mt-0.5" />
              <p className="text-sm text-ink">{activeItem.titulo}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Add topic */}
      {addingTopico ? (
        <div className="rounded-xl border border-edge bg-surface p-4 space-y-2">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Novo tópico</p>
          <div className="flex gap-2">
            <input
              value={addTopicoState.nome}
              onChange={e => setAddTopicoState(s => ({ ...s, nome: e.target.value }))}
              placeholder="Nome do tópico"
              autoFocus
              className="flex-1 rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none"
            />
            <input
              type="number" min={0} step={0.01}
              value={addTopicoState.peso}
              onChange={e => setAddTopicoState(s => ({ ...s, peso: e.target.value }))}
              placeholder="Peso"
              className="w-24 rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink text-center focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddTopico} disabled={addTopicoSaving || !addTopicoState.nome.trim()} className="flex items-center gap-1.5 rounded-lg bg-ember px-3 py-1.5 text-xs font-semibold text-ember-ink hover:bg-ember-hover disabled:opacity-40 transition-colors">
              <Check className="h-3.5 w-3.5" />{addTopicoSaving ? 'Criando...' : 'Criar tópico'}
            </button>
            <button onClick={() => { setAddingTopico(false); setAddTopicoState({ nome: '', peso: '0' }) }} className="flex items-center gap-1.5 rounded-lg border border-edge-strong px-3 py-1.5 text-xs text-ink-muted hover:text-ink transition-colors">
              <X className="h-3.5 w-3.5" />Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddingTopico(true)}
          className="flex items-center gap-2 text-sm text-ink-faint hover:text-ink transition-colors"
        >
          <Plus className="h-4 w-4" />Adicionar tópico
        </button>
      )}

      <div className="pt-2 border-t border-edge/40">
        <p className="text-xs text-ink-faint">{topicos.length} tópico{topicos.length !== 1 ? 's' : ''} · {totalItems} item{totalItems !== 1 ? 's' : ''}</p>
      </div>
    </div></EquipmentEditorContext.Provider>
  )
}
