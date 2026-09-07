'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Printer, ChevronDown, ChevronUp, Tag, Clock3, ChefHat, Trash2, ArrowUpRight, CalendarDays } from 'lucide-react'
import type { KpiItem, LabelGroup } from '../painel/page'
import { printBrandHeader } from '@/lib/brand'

const STATUS_BADGE: Record<string, string> = {
  ativa: 'text-fresh-bright bg-fresh/10',
  consumida: 'text-info bg-info/10',
  descartada: 'text-alert-bright bg-alert/10',
  vencida: 'text-warn-bright bg-warn/10',
  pending: 'text-ink-muted bg-edge',
  in_progress: 'text-info bg-info/10',
  completed: 'text-fresh-bright bg-fresh/10',
  cancelled: 'text-alert-bright bg-alert/10',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function timeRemaining(iso: string) {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff < 0) return 'VENCIDA'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return `${h}h ${m}m`
}

function printTable(title: string, headers: string[], rows: string[][]) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title>
<style>
@page{size:A4;margin:20mm}
body{font-family:Arial,sans-serif;font-size:11pt;color:#111}
h1{font-size:14pt;margin-bottom:4px}
p.sub{font-size:9pt;color:#666;margin-bottom:12px}
table{width:100%;border-collapse:collapse}
th{background:#f0f0f0;padding:6px 8px;text-align:left;font-size:9pt;border-bottom:2px solid #ccc}
td{padding:5px 8px;font-size:9pt;border-bottom:1px solid #eee}
.foot{margin-top:16px;font-size:8pt;color:#888}
</style></head><body>
${printBrandHeader()}
<h1>${title}</h1>
<p class="sub">Impresso em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
<table>
<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
</table>
<div class="foot">MISE · KPH Participações</div>
</body></html>`
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
  setTimeout(() => w.print(), 250)
}

type ModalConfig = {
  title: string
  items: KpiItem[]
  headers: string[]
  renderRow: (item: KpiItem) => { main: string; sub: string; right: string; badge?: string }
  printRow: (item: KpiItem) => string[]
}

function KpiModal({ config, onClose }: { config: ModalConfig; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  function handlePrint() {
    printTable(config.title, config.headers, config.items.map(config.printRow))
  }

  return (
    <dialog ref={dialogRef} aria-label={config.title} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }} className="fixed inset-0 m-auto w-[calc(100%-32px)] max-w-lg rounded-xl bg-transparent p-0 text-ink">
      <div className="flex w-full max-w-lg flex-col rounded-xl border border-edge bg-surface shadow-xl max-h-[80vh]">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-edge px-5 py-4">
          <p className="text-sm font-semibold text-ink">{config.title}</p>
          <div className="flex items-center gap-2">
            {config.items.length > 0 && (
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 rounded-lg border border-edge-strong px-3 py-1.5 text-xs text-ink-muted hover:text-ink transition-colors">
                <Printer className="h-3.5 w-3.5" />
                Imprimir
              </button>
            )}
            <button onClick={onClose} aria-label="Fechar detalhes"
              className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-surface-raised hover:text-ink transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-edge">
          {config.items.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-ink-subtle">Nenhum item.</p>
          )}
          {config.items.map(item => {
            const { main, sub, right, badge } = config.renderRow(item)
            return (
              <div key={item.id} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-raised/50 transition-colors">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{main}</p>
                  <p className="truncate text-xs text-ink-subtle">{sub}</p>
                </div>
                <div className="shrink-0 text-right">
                  {badge && (
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[badge] ?? ''}`}>
                      {badge}
                    </span>
                  )}
                  <p className="mt-0.5 text-xs text-ink-muted">{right}</p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="shrink-0 border-t border-edge px-5 py-3">
          <p className="text-xs text-ink-subtle">{config.items.length} item{config.items.length !== 1 ? 's' : ''}</p>
        </div>
      </div>
    </dialog>
  )
}

function LabelGroupRow({ group }: { group: LabelGroup }) {
  const [expanded, setExpanded] = useState(false)
  const canExpand = group.count > 1

  return (
    <div>
      <div
        className={`flex items-center justify-between px-5 py-3 transition-colors ${canExpand ? 'cursor-pointer hover:bg-surface-raised/50' : 'hover:bg-surface-raised/50'}`}
        onClick={() => canExpand && setExpanded(e => !e)}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-ink">{group.nome}</p>
            {canExpand && (
              <span className="shrink-0 rounded-full bg-ember-soft px-1.5 py-0.5 text-[10px] font-semibold text-ember">
                ×{group.count}
              </span>
            )}
          </div>
          <p className="text-xs text-ink-subtle">{group.unit_name}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[group.status] ?? ''}`}>
            {group.status}
          </span>
          {canExpand && (
            <span className="text-ink-muted">
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </span>
          )}
        </div>
      </div>

      {expanded && canExpand && (
        <div className="border-t border-edge/50 bg-surface-raised/30">
          {group.items.map(item => (
            <div key={item.id} className="flex items-center justify-between px-8 py-2 border-b border-edge/30 last:border-0">
              <p className="text-xs text-ink-muted">
                {item.employee_name !== '—' ? item.employee_name : '—'}
              </p>
              <p className="text-xs text-ink-subtle">
                {item.data_manipulacao ? formatDate(item.data_manipulacao) : '—'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type Props = {
  units: { id: string; name: string }[]
  currentUnit: string
  kpiEtiquetasHoje: KpiItem[]
  kpiCriticas: KpiItem[]
  kpiProducoes: KpiItem[]
  kpiDescartes: KpiItem[]
  labelGroups: LabelGroup[]
  preview?: boolean
}

type OpenModal = 'etiquetas' | 'criticas' | 'producoes' | 'descartes' | null

export function DashboardClient({
  units,
  currentUnit,
  kpiEtiquetasHoje,
  kpiCriticas,
  kpiProducoes,
  kpiDescartes,
  labelGroups,
  preview = false,
}: Props) {
  const router = useRouter()
  const [openModal, setOpenModal] = useState<OpenModal>(null)

  function handleUnitChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    const params = new URLSearchParams(preview ? { module: '/painel' } : {})
    if (val) params.set('unit', val)
    router.push(`${preview ? '/preview' : '/painel'}${params.size ? `?${params}` : ''}`)
  }

  const MODALS: Record<NonNullable<OpenModal>, ModalConfig> = {
    etiquetas: {
      title: 'Etiquetas Hoje',
      items: kpiEtiquetasHoje,
      headers: ['Produto', 'Unidade', 'Responsável', 'Manipulação', 'Status'],
      renderRow: item => ({
        main: item.nome,
        sub: `${item.unit_name} · ${item.employee_name}`,
        right: item.data_manipulacao ? formatDate(item.data_manipulacao) : '—',
        badge: item.status,
      }),
      printRow: item => [
        item.nome,
        item.unit_name,
        item.employee_name,
        item.data_manipulacao ? formatDate(item.data_manipulacao) : '—',
        item.status ?? '—',
      ],
    },
    criticas: {
      title: 'Validades Críticas (24h)',
      items: kpiCriticas,
      headers: ['Produto', 'Unidade', 'Validade', 'Restante'],
      renderRow: item => ({
        main: item.nome,
        sub: item.unit_name,
        right: item.validade ? timeRemaining(item.validade) : '—',
        badge: item.status,
      }),
      printRow: item => [
        item.nome,
        item.unit_name,
        item.validade ? formatDate(item.validade) : '—',
        item.validade ? timeRemaining(item.validade) : '—',
      ],
    },
    producoes: {
      title: 'Produções do Dia',
      items: kpiProducoes,
      headers: ['Produto', 'Unidade', 'Qtd', 'Agendado para', 'Status'],
      renderRow: item => ({
        main: item.nome,
        sub: item.unit_name,
        right: item.scheduled_for ? formatDate(item.scheduled_for) : (item.created_at ? formatDate(item.created_at) : '—'),
        badge: item.prod_status,
      }),
      printRow: item => [
        item.nome,
        item.unit_name,
        item.quantity != null ? `${item.quantity} ${item.unit ?? ''}`.trim() : '—',
        item.scheduled_for ? formatDate(item.scheduled_for) : '—',
        item.prod_status ?? '—',
      ],
    },
    descartes: {
      title: 'Descartes do Dia',
      items: kpiDescartes,
      headers: ['Produto', 'Unidade', 'Responsável', 'Descartado em'],
      renderRow: item => ({
        main: item.nome,
        sub: `${item.unit_name} · ${item.employee_name}`,
        right: item.created_at ? formatDate(item.created_at) : '—',
        badge: 'descartada',
      }),
      printRow: item => [
        item.nome,
        item.unit_name,
        item.employee_name,
        item.created_at ? formatDate(item.created_at) : '—',
      ],
    },
  }

  const CARDS = [
    { key: 'etiquetas' as const, label: 'Etiquetas emitidas', value: kpiEtiquetasHoje.length, color: 'text-ember', icon: Tag, detail: 'Manipuladas hoje' },
    { key: 'criticas' as const, label: 'Validades críticas', value: kpiCriticas.length, color: 'text-warn', icon: Clock3, detail: 'Vencidas ou vencem em 24h' },
    { key: 'producoes' as const, label: 'Produções do dia', value: kpiProducoes.length, color: 'text-info', icon: ChefHat, detail: 'Ordens registradas hoje' },
    { key: 'descartes' as const, label: 'Etiquetas descartadas', value: kpiDescartes.length, color: 'text-alert-bright', icon: Trash2, detail: 'Etiquetas criadas hoje' },
  ]

  return (
    <div className="mx-auto max-w-[1540px] p-5 sm:p-8 lg:p-10 space-y-7">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="section-eyebrow mb-2">VISÃO GERAL</p>
          <h1 className="text-3xl font-medium tracking-tight text-ink">Painel da operação<span className="text-ember">.</span></h1>
          <p className="mt-2 flex items-center gap-2 text-xs text-ink-subtle"><CalendarDays size={13} />Indicadores de hoje · {preview ? 'dados demonstrativos' : 'acompanhamento da cozinha'}</p>
        </div>
        <select
          aria-label="Filtrar painel por unidade"
          value={currentUnit}
          onChange={handleUnitChange}
          className="min-h-11 max-w-full rounded-lg border border-edge-strong bg-surface px-4 py-2 text-xs text-ink"
        >
          <option value="">Todas as unidades</option>
          {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {CARDS.map(({ key, label, value, color, icon: Icon, detail }) => (
          <button
            key={key}
            onClick={() => setOpenModal(key)}
            className="group rounded-xl border border-edge bg-surface p-5 text-left transition-colors hover:border-edge-strong hover:bg-surface-raised/50"
          >
            <div className="mb-5 flex items-center justify-between"><Icon size={18} className={color} /><ArrowUpRight size={14} className="text-ink-faint group-hover:text-ink" /></div>
            <p className="text-[11px] font-medium text-ink-subtle">{label}</p>
            <p className={`mt-2 text-4xl font-medium tracking-tight tabular-nums ${color}`}>{value.toString().padStart(2, '0')}</p>
            <p className="mt-4 border-t border-edge pt-3 text-[10px] text-ink-faint">{detail}</p>
          </button>
        ))}
      </div>

      {/* Bottom 2-col grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Label groups */}
        <div className="rounded-xl border border-edge bg-surface">
          <div className="border-b border-edge px-5 py-4">
            <p className="text-sm font-semibold text-ink">Últimas Etiquetas</p>
          </div>
          <div className="divide-y divide-edge">
            {labelGroups.length === 0 && (
              <p className="px-5 py-4 text-sm text-ink-subtle">Nenhuma etiqueta.</p>
            )}
            {labelGroups.map(g => <LabelGroupRow key={g.key} group={g} />)}
          </div>
        </div>

        {/* Validades críticas */}
        <div className="rounded-xl border border-edge bg-surface">
          <div className="border-b border-edge px-5 py-4">
            <p className="text-sm font-semibold text-ink">Validades Críticas (24h)</p>
          </div>
          <div className="divide-y divide-edge">
            {kpiCriticas.length === 0 && (
              <p className="px-5 py-4 text-sm text-ink-subtle">Sem validades críticas.</p>
            )}
            {kpiCriticas.map(item => {
              const diff = item.validade ? new Date(item.validade).getTime() - Date.now() : -1
              return (
                <div key={item.id} className="flex items-center justify-between px-5 py-3 hover:bg-surface-raised/50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-ink">{item.nome}</p>
                    <p className="text-xs text-ink-subtle">{item.unit_name}</p>
                  </div>
                  <p className={`text-xs font-medium ${diff < 0 ? 'text-alert-bright' : 'text-warn-bright'}`}>
                    {diff < 0 ? 'VENCIDA' : `${Math.floor(diff / 3600000)}h restantes`}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Modal */}
      {openModal && (
        <KpiModal config={MODALS[openModal]} onClose={() => setOpenModal(null)} />
      )}
    </div>
  )
}
