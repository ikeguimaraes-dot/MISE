'use client'

import { useState, useEffect, useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Printer, AlertTriangle, CheckCircle, Bluetooth } from 'lucide-react'

type Ingredient = { id: string; nome: string; categoria_anvisa: string | null }
type MenuItem = { id: string; nome: string }
type Employee = { id: string; nome: string }
type Unit = { id: string; name: string; cnpj?: string | null; address?: string | null }
type PrintPoint = { id: string; name: string; icone: string | null }

const CATEGORIA_ANVISA_OPTIONS = [
  { value: 'proteina_animal_cozida', label: 'Proteína Animal Cozida' },
  { value: 'proteina_animal_crua', label: 'Proteína Animal Crua' },
  { value: 'pescado_cru', label: 'Pescado Cru' },
  { value: 'pescado_cozido', label: 'Pescado Cozido' },
  { value: 'vegetal_cozido', label: 'Vegetal Cozido' },
  { value: 'vegetal_cru', label: 'Vegetal Cru' },
  { value: 'arroz_massa_cereais', label: 'Arroz / Massa / Cereais' },
  { value: 'molho_caldo', label: 'Molho / Caldo' },
  { value: 'laticinios', label: 'Laticínios' },
  { value: 'sobremesa', label: 'Sobremesa' },
  { value: 'fritura', label: 'Fritura' },
]

const METODOS = [
  'Resfriado 0-5°C',
  'Refrigerado 5-10°C',
  'Congelado -18°C',
  'Temperatura ambiente',
]

const SELOS = ['Nenhum', 'SIF', 'SISP', 'SIM'] as const

const AVATAR_COLORS = [
  'bg-fresh', 'bg-info', 'bg-purple-600', 'bg-orange-600',
  'bg-alert', 'bg-cyan-600', 'bg-pink-600', 'bg-yellow-600',
]

function getColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function getInitials(nome: string) {
  const p = nome.trim().split(' ')
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase()
  return (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

function nowLocalISO(): string {
  const sp = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${sp.getFullYear()}-${p(sp.getMonth() + 1)}-${p(sp.getDate())}T${p(sp.getHours())}:${p(sp.getMinutes())}`
}

export function LabelForm({
  ingredients,
  menuItems,
  employees,
  units,
}: {
  ingredients: Ingredient[]
  menuItems: MenuItem[]
  employees: Employee[]
  units: Unit[]
}) {
  const [search, setSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; nome: string; tipo: 'ingrediente' | 'preparacao'; categoria_anvisa?: string | null } | null>(null)
  const [tipo, setTipo] = useState<'ingrediente' | 'preparacao' | 'porcao'>('ingrediente')
  const [categoria, setCategoria] = useState('')
  const [categoriaFromCadastro, setCategoriaFromCadastro] = useState(false)
  const [pesoG, setPesoG] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
  const [empSearch, setEmpSearch] = useState('')
  const [selectedUnit, setSelectedUnit] = useState<string>('')
  const [setor, setSetor] = useState('')
  const [lote, setLote] = useState('')
  const [selo, setSelo] = useState<'Nenhum' | 'SIF' | 'SISP' | 'SIM'>('Nenhum')
  const [validadeFornecedor, setValidadeFornecedor] = useState('')
  const [metodo, setMetodo] = useState('')
  const [dataManipulacao, setDataManipulacao] = useState(nowLocalISO())
  const [validade, setValidade] = useState('')
  const [validadeReadonly, setValidadeReadonly] = useState(false)
  const [prazoHoras, setPrazoHoras] = useState<number | null>(null)
  const [shelfLifeSource, setShelfLifeSource] = useState<'custom' | 'anvisa' | null>(null)
  const [printPoints, setPrintPoints] = useState<PrintPoint[]>([])
  const [printPointId, setPrintPointId] = useState('')
  const [savedLabel, setSavedLabel] = useState<{ id: string; nome: string; unit?: Unit } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [conflictLabel, setConflictLabel] = useState<{ id: string; nome: string; data_manipulacao: string; validade: string; employee_name: string } | null>(null)
  const [showConflictModal, setShowConflictModal] = useState(false)
  const [conflictResolution, setConflictResolution] = useState<'none' | 'overwrite' | 'keep'>('none')

  const searchResults = search.length >= 2
    ? [
        ...ingredients.filter(i => i.nome.toLowerCase().includes(search.toLowerCase())).map(i => ({ ...i, tipo: 'ingrediente' as const })),
        ...menuItems.filter(m => m.nome.toLowerCase().includes(search.toLowerCase())).map(m => ({ id: m.id, nome: m.nome, tipo: 'preparacao' as const, categoria_anvisa: null })),
      ].slice(0, 8)
    : []

  const filteredEmployees = empSearch
    ? employees.filter(e => e.nome.toLowerCase().includes(empSearch.toLowerCase()))
    : employees

  useEffect(() => {
    if (!selectedProduct || !selectedUnit) return
    const ingredientId = selectedProduct.tipo === 'ingrediente' ? selectedProduct.id : undefined
    if (!ingredientId) return
    let cancelled = false
    fetch(`/api/labels/check-conflict?ingredient_id=${ingredientId}&unit_id=${selectedUnit}`)
      .then(r => r.json())
      .then(data => {
        if (!cancelled && data.conflict) {
          setConflictLabel(data.conflict)
          setShowConflictModal(true)
          setConflictResolution('none')
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [selectedProduct, selectedUnit])

  useEffect(() => {
    if (!metodo) {
      setValidadeReadonly(false)
      setPrazoHoras(null)
      setShelfLifeSource(null)
      return
    }

    const ingredientId = selectedProduct?.tipo === 'ingrediente' ? selectedProduct.id : null

    // Precisa de pelo menos ingredient_id ou categoria para buscar
    if (!ingredientId && !categoria) {
      setValidadeReadonly(false)
      setPrazoHoras(null)
      setShelfLifeSource(null)
      return
    }

    let cancelled = false
    const params = new URLSearchParams({ metodo })
    if (ingredientId) params.set('ingredient_id', ingredientId)
    if (categoria) params.set('categoria', categoria)

    fetch(`/api/shelf-life-rule?${params}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        if (data.prazo_horas) {
          setPrazoHoras(data.prazo_horas)
          setValidadeReadonly(true)
          setShelfLifeSource(data.source ?? null)
        } else {
          setPrazoHoras(null)
          setValidadeReadonly(false)
          setShelfLifeSource(null)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [categoria, metodo, selectedProduct])

  useEffect(() => {
    if (!prazoHoras || !dataManipulacao) return
    const base = new Date(dataManipulacao)
    base.setHours(base.getHours() + prazoHoras)
    const p = (n: number) => String(n).padStart(2, '0')
    setValidade(`${base.getFullYear()}-${p(base.getMonth() + 1)}-${p(base.getDate())}T${p(base.getHours())}:${p(base.getMinutes())}`)
  }, [prazoHoras, dataManipulacao])

  useEffect(() => {
    if (!selectedUnit) { setPrintPoints([]); setPrintPointId(''); return }
    fetch(`/api/print-points?unit_id=${selectedUnit}`)
      .then(r => r.json())
      .then(data => { setPrintPoints(data.print_points ?? []); setPrintPointId('') })
      .catch(() => {})
  }, [selectedUnit])

  function handleSelectProduct(p: { id: string; nome: string; tipo: 'ingrediente' | 'preparacao'; categoria_anvisa?: string | null }) {
    setSelectedProduct(p)
    setSearch(p.nome)
    setTipo(p.tipo === 'ingrediente' ? 'ingrediente' : 'preparacao')
    setCategoria('')
    setCategoriaFromCadastro(false)
    setPrazoHoras(null)
    setValidadeReadonly(false)
    setShelfLifeSource(null)
    setValidade('')
    if (p.tipo === 'ingrediente' && p.categoria_anvisa) {
      setCategoria(p.categoria_anvisa)
      setCategoriaFromCadastro(true)
    }
    setConflictLabel(null)
    setConflictResolution('none')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProduct || !selectedUnit || !dataManipulacao || !validade) return
    if (conflictLabel && conflictResolution === 'none') {
      setShowConflictModal(true)
      return
    }

    setSaving(true)
    setError('')

    if (conflictLabel && conflictResolution === 'overwrite') {
      await fetch(`/api/labels/${conflictLabel.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'descartada' }),
      })
    }

    const payload = {
      unit_id: selectedUnit,
      employee_id: selectedEmployee || null,
      ingredient_id: selectedProduct.tipo === 'ingrediente' ? selectedProduct.id : null,
      menu_item_id: selectedProduct.tipo === 'preparacao' ? selectedProduct.id : null,
      tipo,
      nome: selectedProduct.nome,
      peso_kg: pesoG ? Number(pesoG) / 1000 : null,
      setor: setor || null,
      lote: lote || null,
      selo: selo !== 'Nenhum' ? selo : null,
      validade_fornecedor: validadeFornecedor || null,
      metodo_conservacao: metodo || null,
      data_manipulacao: new Date(dataManipulacao).toISOString(),
      validade: new Date(validade).toISOString(),
      print_point_id: printPointId || null,
      status: 'ativa',
    }

    const res = await fetch('/api/labels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Erro ao salvar etiqueta.')
      setSaving(false)
      return
    }

    const { id } = await res.json()
    const unitObj = units.find(u => u.id === selectedUnit)
    setSavedLabel({ id, nome: selectedProduct.nome, unit: unitObj })
    setSaving(false)
  }

  function handlePrint() {
    if (!savedLabel) return
    const canvas = document.getElementById('label-qr-canvas') as HTMLCanvasElement | null
    const qrDataUrl = canvas?.toDataURL('image/png') ?? ''
    const fmtDate = (v: string) => new Date(v).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const respNome = (employees.find(e => e.id === selectedEmployee)?.nome ?? '').split(' ')[0]
    const unit = savedLabel.unit
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Etiqueta</title>
<style>@page{size:60mm 40mm;margin:0}
html,body{margin:0;padding:0;width:60mm;height:40mm;overflow:hidden;font-family:monospace}
.label{width:60mm;height:40mm;padding:2mm;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;background:#fff;color:#000;font-size:7pt;overflow:hidden;page-break-inside:avoid;page-break-after:avoid}
.nome{font-size:11pt;font-weight:bold;line-height:1.0}
.cnpj{font-size:5pt;line-height:1.1;margin-top:0.3mm}
.metodo{font-size:6pt;line-height:1.1;margin-top:0.3mm}
.dates{font-size:7pt;line-height:1.2}.dates b{font-weight:bold}
.validade{font-size:11pt;font-weight:bold;line-height:1.1}
.bottom{display:flex;justify-content:space-between;align-items:flex-end;gap:2mm}
.binfo{min-width:0}
.resp{font-size:6pt;font-weight:bold}
.endereco{font-size:4.5pt;line-height:1.0;margin-top:0.3mm}
.id{font-size:6pt;margin-top:0.3mm}
.qr{flex-shrink:0}
</style></head><body>
<div class="label">
  <div>
    <div class="nome">${savedLabel.nome}</div>
    ${unit?.cnpj ? `<div class="cnpj">CNPJ: ${unit.cnpj}</div>` : ''}
    ${metodo ? `<div class="metodo">${metodo}</div>` : ''}
  </div>
  <div class="dates">
    <div><b>MANIPULAÇÃO:</b> ${fmtDate(dataManipulacao)}</div>
    <div class="validade">VALIDADE: ${fmtDate(validade)}</div>
    ${pesoG ? `<div><b>PESO:</b> ${pesoG}g</div>` : ''}
  </div>
  <div class="bottom">
    <div class="binfo">
      <div class="resp">RESP.: ${respNome}</div>
      ${unit?.address ? `<div class="endereco">${unit.address}</div>` : ''}
      <div class="id">#${savedLabel.id.slice(0, 6).toUpperCase()}</div>
    </div>
    <div class="qr"><img src="${qrDataUrl}" width="40" height="40"/></div>
  </div>
</div>
</body></html>`
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 250)
  }

  // Monta a string de comandos TSPL da etiqueta 60x40mm (480x320 dots @ 203dpi),
  // replicando o layout do preview visual. Compartilhada por ambas as variantes RawBT.
  function buildTSPL(): string {
    if (!savedLabel) return ''
    const fmtDate = (v: string) => new Date(v).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const respNome = (employees.find(e => e.id === selectedEmployee)?.nome ?? '').split(' ')[0]
    const unit = savedLabel.unit
    const id = savedLabel.id

    // Remove acentos/aspas para os fonts internos (bitmap) da impressora TSPL.
    const diacritics = new RegExp('[\\u0300-\\u036f]', 'g')
    const ascii = (s: string) =>
      (s ?? '').normalize('NFD').replace(diacritics, '').replace(/"/g, "'")

    const left = 16
    const cmds: string[] = []
    cmds.push('SIZE 60 mm, 40 mm')
    cmds.push('GAP 2 mm, 0 mm')
    cmds.push('DIRECTION 1')
    cmds.push('CLS')

    let y = 12
    // Nome do produto — fonte grande (font "4" = 24x32)
    cmds.push(`TEXT ${left},${y},"4",0,1,1,"${ascii(savedLabel.nome)}"`)
    y += 34
    if (unit?.cnpj) {
      cmds.push(`TEXT ${left},${y},"1",0,1,1,"CNPJ: ${ascii(unit.cnpj)}"`)
      y += 16
    }
    if (metodo) {
      cmds.push(`TEXT ${left},${y},"1",0,1,1,"${ascii(metodo)}"`)
      y += 16
    }
    // Separador
    y += 2
    cmds.push(`BAR ${left},${y},448,2`)
    y += 10
    // Manipulação — fonte média (font "2" = 12x20)
    cmds.push(`TEXT ${left},${y},"2",0,1,1,"MANIP.: ${fmtDate(dataManipulacao)}"`)
    y += 24
    // Validade — fonte grande e negrito (mesmo tamanho do nome, font "4")
    cmds.push(`TEXT ${left},${y},"4",0,1,1,"VAL.: ${fmtDate(validade)}"`)
    y += 36
    if (pesoG) {
      cmds.push(`TEXT ${left},${y},"2",0,1,1,"PESO: ${pesoG}g"`)
      y += 24
    }
    // Separador
    y += 2
    cmds.push(`BAR ${left},${y},448,2`)
    y += 8
    // Linha inferior: RESP./endereco/#ID (esquerda) + QR code (direita)
    const rowY = y
    cmds.push(`TEXT ${left},${rowY + 4},"2",0,1,1,"RESP.: ${ascii(respNome)}"`)
    cmds.push(`QRCODE 366,${rowY},M,3,A,0,"${id}"`)
    let yLeft = rowY + 28
    if (unit?.address) {
      cmds.push(`TEXT ${left},${yLeft},"1",0,1,1,"${ascii(unit.address)}"`)
      yLeft += 18
    }
    cmds.push(`TEXT ${left},${yLeft},"2",0,1,1,"#${id.slice(0, 6).toUpperCase()}"`)
    cmds.push('PRINT 1')

    return cmds.join('\r\n') + '\r\n'
  }

  // Bytes UTF-8 → base64 (método seguro, evita corromper bytes >127 que btoa direto quebraria).
  function tsplToBase64(tspl: string): string {
    const bytes = new TextEncoder().encode(tspl)
    let bin = ''
    bytes.forEach(b => (bin += String.fromCharCode(b)))
    return btoa(bin)
  }

  // VARIANTE PRINCIPAL — content-type text/prn força o RawBT a repassar os bytes crus
  // (passthrough) em vez de rasterizar como texto via engine ESC/POS.
  function handlePrintRawBT() {
    if (!savedLabel) return
    const b64 = tsplToBase64(buildTSPL())
    const url = `intent:data:text/prn;base64,${b64}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`
    window.location.href = url
  }

  // VARIANTE FALLBACK — Job JSON do RawBT com printer "raw_transfer" + comando sendBytes.
  function handlePrintRawBTJson() {
    if (!savedLabel) return
    const b64 = tsplToBase64(buildTSPL())
    const job = {
      template: 'none',
      printer: 'raw_transfer',
      commands: [{ command: 'sendBytes', base64: b64 }],
    }
    const url =
      'intent:#Intent;' +
      'action=rawbt.action.PRINT;' +
      'package=ru.a402d.rawbtprinter;' +
      'S.rawbt.action.extra.JOB_JSON=' + encodeURIComponent(JSON.stringify(job)) + ';' +
      'end;'
    window.location.href = url
  }

  return (
    <div className="rounded-xl border border-edge bg-surface">
      <div className="border-b border-edge px-5 py-4">
        <p className="text-sm font-semibold text-ink">Nova Etiqueta</p>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Produto */}
          <div className="relative">
            <label className="block text-xs font-medium text-ink-muted mb-1">Produto *</label>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); if (!e.target.value) setSelectedProduct(null) }}
              placeholder="Buscar produto (mín. 2 letras)"
              className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:border-ink-subtle focus:outline-none"
            />
            {searchResults.length > 0 && !selectedProduct && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-edge-strong bg-surface shadow-lg">
                {searchResults.map(r => (
                  <button key={r.id} type="button" onClick={() => handleSelectProduct(r)}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm text-ink hover:bg-surface-raised transition-colors">
                    <span>{r.nome}</span>
                    <span className="text-xs text-ink-subtle capitalize">{r.tipo}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Unidade */}
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">Unidade *</label>
            <select value={selectedUnit} onChange={e => setSelectedUnit(e.target.value)} required
              className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none">
              <option value="">Selecionar unidade</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          {/* Categoria ANVISA — oculta quando há validade customizada do Suflex */}
          {selectedProduct && shelfLifeSource !== 'custom' && (
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">Categoria ANVISA</label>
              {categoriaFromCadastro ? (
                <div className="flex items-center gap-2 rounded-lg border border-fresh/40 bg-fresh-soft px-3 py-2">
                  <CheckCircle className="h-4 w-4 text-fresh-bright shrink-0" />
                  <span className="text-sm text-fresh-bright">
                    {CATEGORIA_ANVISA_OPTIONS.find(o => o.value === categoria)?.label ?? categoria}
                  </span>
                  <span className="ml-auto text-xs text-fresh">Do cadastro do produto</span>
                </div>
              ) : (
                <>
                  <select value={categoria} onChange={e => setCategoria(e.target.value)}
                    className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none">
                    <option value="">Selecionar categoria</option>
                    {CATEGORIA_ANVISA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {selectedProduct.tipo === 'ingrediente' && !categoria && (
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-warn">
                      <AlertTriangle className="h-3 w-3" />
                      <span>Sem categoria — <a href={`/cadastros/produtos/${selectedProduct.id}`} className="underline">preencher no cadastro</a></span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Método de conservação */}
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">Método de conservação</label>
            <select value={metodo} onChange={e => setMetodo(e.target.value)}
              className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none">
              <option value="">Selecionar método</option>
              {METODOS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Peso */}
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">Peso (gramas)</label>
            <input type="number" value={pesoG} onChange={e => setPesoG(e.target.value)} min="0" step="1"
              placeholder="ex: 1500"
              className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:outline-none" />
          </div>

          {/* Setor */}
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">Setor</label>
            <input value={setor} onChange={e => setSetor(e.target.value)} placeholder="ex: Cozinha Quente"
              className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:outline-none" />
          </div>

          {/* Lote */}
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">Lote</label>
            <input value={lote} onChange={e => setLote(e.target.value)} placeholder="ex: L2024001"
              className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:outline-none" />
          </div>

          {/* Validade fornecedor */}
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">Validade original (fornecedor)</label>
            <input type="date" value={validadeFornecedor} onChange={e => setValidadeFornecedor(e.target.value)}
              className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none" />
          </div>

          {/* Data manipulação */}
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">Data de manipulação *</label>
            <input type="datetime-local" value={dataManipulacao} onChange={e => setDataManipulacao(e.target.value)} required
              className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none" />
          </div>

          {/* Validade */}
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">Validade *</label>
            {validadeReadonly ? (
              <div className="flex items-center gap-2 rounded-lg border border-fresh/40 bg-fresh-soft px-3 py-2">
                <CheckCircle className="h-4 w-4 text-fresh-bright shrink-0" />
                <span className="text-sm text-fresh-bright">
                  {validade ? new Date(validade).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                </span>
                <span className="ml-auto text-xs text-fresh">
                  {shelfLifeSource === 'custom' ? `Suflex · ${prazoHoras}h` : `ANVISA · ${prazoHoras}h`}
                </span>
              </div>
            ) : (
              <input type="datetime-local" value={validade} onChange={e => setValidade(e.target.value)} required
                className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none" />
            )}
          </div>
        </div>

        {/* Selo */}
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-2">Selo de inspeção</label>
          <div className="flex gap-2">
            {SELOS.map(s => (
              <button key={s} type="button" onClick={() => setSelo(s)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  selo === s ? 'border-ember bg-ember text-ember-ink' : 'border-edge-strong text-ink-muted hover:text-ink'
                }`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Responsável */}
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-2">Responsável</label>
          {employees.length > 6 && (
            <input value={empSearch} onChange={e => setEmpSearch(e.target.value)} placeholder="Buscar funcionário"
              className="mb-2 w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:outline-none" />
          )}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {filteredEmployees.map(e => (
              <button key={e.id} type="button" onClick={() => setSelectedEmployee(e.id)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-colors min-h-[80px] ${
                  selectedEmployee === e.id ? 'border-ember bg-ember-soft' : 'border-edge bg-surface-raised/50 hover:border-edge-strong'
                }`}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-ink ${getColor(e.id)}`}>
                  {getInitials(e.nome)}
                </div>
                <span className="text-xs text-ink-muted leading-tight">{e.nome.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Ponto de impressão */}
        {printPoints.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">Ponto de impressão</label>
            <select value={printPointId} onChange={e => setPrintPointId(e.target.value)}
              className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none">
              <option value="">Sem ponto de impressão</option>
              {printPoints.map(p => <option key={p.id} value={p.id}>{p.icone ? `${p.icone} ` : ''}{p.name}</option>)}
            </select>
          </div>
        )}

        {error && <p className="text-sm text-alert-bright">{error}</p>}

        {conflictLabel && conflictResolution === 'none' && (
          <div className="rounded-lg border border-warn/40 bg-warn-soft px-4 py-3 text-sm text-warn-bright">
            <AlertTriangle className="mb-1 h-4 w-4" />
            Etiqueta ativa para este produto nesta unidade.{' '}
            <a href="/validades" className="underline">Ver detalhes</a>
          </div>
        )}

        <button
          type="submit"
          disabled={saving || !selectedProduct || !selectedUnit || (selectedProduct?.tipo === 'ingrediente' && !categoria && shelfLifeSource !== 'custom')}
          className="rounded-lg bg-ember px-4 py-2.5 text-sm font-semibold text-ember-ink hover:bg-ember-hover disabled:opacity-40 transition-colors"
        >
          {saving ? 'Salvando...' : 'Gerar Etiqueta'}
        </button>
      </form>

      {/* Conflito Modal */}
      {showConflictModal && conflictLabel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-edge bg-surface p-6 space-y-4">
            <h2 className="font-semibold text-ink">Etiqueta ativa encontrada</h2>
            <div className="rounded-lg border border-edge bg-base p-3 text-sm space-y-1">
              <p className="text-ink font-medium">{conflictLabel.nome}</p>
              <p className="text-ink-muted">Manipulação: {new Date(conflictLabel.data_manipulacao).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
              <p className="text-ink-muted">Validade: {new Date(conflictLabel.validade).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
              <p className="text-ink-muted">Responsável: {conflictLabel.employee_name}</p>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => { setConflictResolution('overwrite'); setShowConflictModal(false) }}
                className="rounded-lg bg-alert px-4 py-2 text-sm font-medium text-alert-ink hover:bg-alert-bright transition-colors">
                Sobrepor (descartar a existente)
              </button>
              <button onClick={() => { setConflictResolution('keep'); setShowConflictModal(false) }}
                className="rounded-lg border border-edge-strong px-4 py-2 text-sm font-medium text-ink-muted hover:text-ink transition-colors">
                Gerar nova (manter a existente)
              </button>
              <button onClick={() => { setShowConflictModal(false) }}
                className="text-sm text-ink-subtle hover:text-ink-muted transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview */}
      {savedLabel && (
        <div className="border-t border-edge p-5 space-y-4">
          <p className="text-sm font-medium text-fresh-bright">Etiqueta gerada com sucesso!</p>
          <div
            style={{ width: '10cm', aspectRatio: '10/6', background: '#fff', color: '#000', fontFamily: 'monospace', padding: '4mm', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '8pt' }}
            className="rounded border"
          >
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '9pt' }}>
                {units.find(u => u.id === selectedUnit)?.name ?? ''}
              </div>
              {units.find(u => u.id === selectedUnit)?.cnpj && (
                <div style={{ fontSize: '7pt', color: '#555' }}>CNPJ: {units.find(u => u.id === selectedUnit)!.cnpj}</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '4mm', alignItems: 'flex-start' }}>
              <QRCodeCanvas id="label-qr-canvas" value={savedLabel.id} size={60} />
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '10pt' }}>{savedLabel.nome}</div>
                <div style={{ fontSize: '7pt', color: '#555' }}>Manip: {new Date(dataManipulacao).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</div>
                <div style={{ fontSize: '7pt', color: '#555' }}>Val: {new Date(validade).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</div>
                {metodo && <div style={{ fontSize: '7pt', color: '#555' }}>{metodo}</div>}
                {pesoG && <div style={{ fontSize: '7pt', color: '#555' }}>Peso: {Number(pesoG).toLocaleString('pt-BR')} g</div>}
                {lote && <div style={{ fontSize: '7pt', color: '#555' }}>Lote: {lote}</div>}
                {selo !== 'Nenhum' && <span style={{ border: '1px solid #000', padding: '0 2px', fontSize: '7pt' }}>{selo}</span>}
              </div>
            </div>
            <div style={{ fontSize: '7pt', color: '#999' }}>#{savedLabel.id.slice(0, 8).toUpperCase()}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-2 rounded-lg border border-edge-strong px-4 py-2 text-sm text-ink-muted hover:text-ink transition-colors">
              <Printer className="h-4 w-4" />
              Imprimir Etiqueta
            </button>
            <button onClick={handlePrintRawBT}
              className="flex items-center gap-2 rounded-lg bg-ember px-4 py-2 text-sm font-semibold text-ember-ink hover:bg-ember-hover transition-colors">
              <Bluetooth className="h-4 w-4" />
              Imprimir (Bluetooth)
            </button>
            <button onClick={handlePrintRawBTJson}
              className="flex items-center gap-2 rounded-lg border border-ember-soft px-3 py-2 text-xs font-medium text-ember hover:bg-ember-soft transition-colors">
              <Bluetooth className="h-3.5 w-3.5" />
              Bluetooth (modo 2)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
