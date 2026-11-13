'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { applyConfirmedLabelAction, getValidityBucket, VALIDITY_CARDS, type ValidityData, type ValidityFilters } from '@/lib/label-validities'

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function ValidadesClient({ initialData }: { initialData: ValidityData }) {
  const [data, setData] = useState(initialData)
  const [filters, setFilters] = useState<ValidityFilters>({ unit: '', bucket: '', page: 1 })
  const [loadedView, setLoadedView] = useState({ unit: '', bucket: '' })
  const [loading, setLoading] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const requestId = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const busy = useRef(false)
  const firstRender = useRef(true)

  const reload = useCallback(async (next: ValidityFilters, showLoading = true) => {
    const sequence = ++requestId.current
    controller.current?.abort()
    const abort = new AbortController()
    controller.current = abort
    if (showLoading) setLoading(true)
    try {
      const params = new URLSearchParams({ unit: next.unit, bucket: next.bucket, page: String(next.page) })
      const response = await fetch(`/api/validades?${params}`, { signal: abort.signal, cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível atualizar as validades.')
      if (sequence === requestId.current && !abort.signal.aborted) { setData(result); setLoadedView({ unit: next.unit, bucket: next.bucket }) }
    } catch (error) {
      if (!abort.signal.aborted && sequence === requestId.current) setError(error instanceof Error ? error.message : 'Falha de conexão. Tente atualizar a lista.')
    } finally {
      if (sequence === requestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    void reload(filters)
  }, [filters, reload])

  useEffect(() => {
    const timer = setInterval(() => { if (!busy.current) void reload(filters, false) }, 30000)
    return () => clearInterval(timer)
  }, [filters, reload])

  useEffect(() => () => { controller.current?.abort() }, [])

  async function handleAction(id: string, status: 'consumida' | 'descartada') {
    if (busy.current) return
    busy.current = true
    ++requestId.current
    controller.current?.abort()
    setPendingId(id)
    setError('')
    setNotice('')
    try {
      const response = await fetch(`/api/labels/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      const result = await response.json()
      if (result.label?.id === id && ['consumida', 'descartada'].includes(result.label.status)) setData(current => applyConfirmedLabelAction(current, id, result.label.status))
      if (!response.ok) throw new Error(result.error || 'Não foi possível salvar a ação.')
      if (result.label?.id !== id) throw new Error('Não foi possível confirmar a gravação. Atualize a lista.')
      setNotice(status === 'consumida' ? 'Uso no preparo registrado.' : 'Perda registrada.')
      await reload(filters)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível confirmar a ação. Tente novamente.')
      await reload(filters, false)
    } finally { busy.current = false; setPendingId(null) }
  }

  const disabled = loading || Boolean(pendingId)
  const viewMatches = loadedView.unit === filters.unit && loadedView.bucket === filters.bucket
  const closedView = filters.bucket === 'consumida' || filters.bucket === 'descartada'
  const title = VALIDITY_CARDS.find(card => card.key === filters.bucket)?.label

  return <div className="space-y-6 p-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-xl font-bold text-ink">Validades</h1><p className="mt-1 text-sm text-ink-muted">Acompanhe as etiquetas e registre o destino dos produtos.</p></div>
      <div className="flex flex-wrap items-end gap-3">
        <div><label htmlFor="validities-unit" className="mb-1 block text-xs text-ink-muted">Unidade</label><select id="validities-unit" value={filters.unit} disabled={disabled} onChange={event => { setError(''); setFilters(current => ({ ...current, unit: event.target.value, page: 1 })) }} className="rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink disabled:opacity-50"><option value="">Todas as unidades</option>{data.units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}{unit.active === false ? ' (inativa)' : ''}</option>)}</select></div>
        <button type="button" disabled={disabled} onClick={() => { setError(''); void reload(filters) }} className="rounded-lg border border-edge-strong px-3 py-2 text-sm text-ink-muted disabled:opacity-50">{loading ? 'Atualizando…' : 'Atualizar'}</button>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {VALIDITY_CARDS.map(card => <button key={card.key} type="button" disabled={disabled} aria-pressed={filters.bucket === card.key} onClick={() => { setError(''); setFilters(current => ({ ...current, bucket: current.bucket === card.key ? '' : card.key, page: 1 })) }} className={`rounded-xl border bg-surface p-4 text-left transition-colors disabled:opacity-60 ${filters.bucket === card.key ? card.border : 'border-edge hover:border-edge-strong'}`}>
        <span className="block text-xs font-medium text-ink-muted">{card.label}</span><span className={`mt-1 block text-3xl font-bold ${card.color}`}>{viewMatches ? data.counts[card.key] : '—'}</span>
        {(card.key === 'consumida' || card.key === 'descartada') && <span className="mt-1 block text-xs text-ink-subtle">Total registrado</span>}
      </button>)}
    </div>
    {error && <p role="alert" className="rounded-lg border border-alert/30 bg-alert-soft p-3 text-sm text-alert-bright">{error}</p>}
    {notice && <p role="status" className="text-sm text-fresh-bright">{notice}</p>}
    <section className="rounded-xl border border-edge bg-surface" aria-busy={loading}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-edge px-5 py-4"><h2 className="text-sm font-semibold text-ink">{closedView ? title : `Etiquetas pendentes${title ? ` — ${title}` : ''}`}</h2><span className="text-xs text-ink-subtle">{viewMatches ? `${data.total} etiqueta${data.total !== 1 ? 's' : ''}` : 'Atualize para carregar este filtro'}</span></div>
      {viewMatches && !data.labels.length && <p className="px-5 py-8 text-center text-sm text-ink-subtle">Nenhuma etiqueta neste filtro.</p>}
      <div className="divide-y divide-edge">{(viewMatches ? data.labels : []).map(label => {
        const terminal = label.status === 'consumida' || label.status === 'descartada'
        const expired = getValidityBucket(label, new Date(data.now)) === 'vencidos'
        return <div key={label.id} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-surface-raised/50">
          <div className="min-w-0 flex-1 basis-44"><p className="text-sm font-medium text-ink">{label.nome}</p><p className="mt-1 text-xs text-ink-subtle">{label.unit_name} · {label.employee_name ?? '—'}</p></div>
          <div className="text-right"><p className="text-xs text-ink-muted">Validade: {formatDate(label.validade)}</p><span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${label.status === 'consumida' ? 'bg-fresh/10 text-fresh-bright' : label.status === 'descartada' || expired ? 'bg-alert/10 text-alert-bright' : 'bg-info/10 text-info'}`}>{terminal ? label.status === 'consumida' ? 'Usado no preparo' : 'Perda' : expired ? 'Vencida' : 'Ativa'}</span></div>
          {!terminal && <div className="flex flex-wrap gap-2">
            <button type="button" disabled={disabled} onClick={() => void handleAction(label.id, 'consumida')} className="min-h-10 rounded-lg border border-info px-3 py-2 text-xs text-info hover:bg-info-soft disabled:opacity-50">{pendingId === label.id ? 'Salvando…' : 'Usado no preparo'}</button>
            <button type="button" disabled={disabled} onClick={() => void handleAction(label.id, 'descartada')} className="min-h-10 rounded-lg border border-alert px-3 py-2 text-xs text-alert-bright hover:bg-alert-soft disabled:opacity-50">Descartar (perda)</button>
          </div>}
        </div>
      })}</div>
      {viewMatches && data.totalPages > 1 && <div className="flex items-center justify-between gap-3 border-t border-edge px-5 py-3 text-xs text-ink-muted"><span>Página {data.page} de {data.totalPages}</span><div className="flex gap-3"><button disabled={disabled || data.page <= 1} onClick={() => setFilters(current => ({ ...current, page: data.page - 1 }))} className="rounded border border-edge px-3 py-2 disabled:opacity-40">Anterior</button><button disabled={disabled || data.page >= data.totalPages} onClick={() => setFilters(current => ({ ...current, page: data.page + 1 }))} className="rounded border border-edge px-3 py-2 disabled:opacity-40">Próxima</button></div></div>}
    </section>
  </div>
}
