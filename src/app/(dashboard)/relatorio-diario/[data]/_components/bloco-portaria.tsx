'use client'
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { RegistroColapsavel } from './registro-colapsavel'

type Desistencia = { id: string; motivo: string | null }
type PortariaData = { id?: string; reservas: string; no_show: string; passantes: string }

function num(v: string) { return parseInt(v) || 0 }
function brl(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

export function BlocoPortaria({
  relatorioData, unitId, disabled,
  portariaInicial, desistenciasIniciais,
}: {
  relatorioData: string; unitId: string; disabled?: boolean
  portariaInicial?: PortariaData
  desistenciasIniciais?: Desistencia[]
}) {
  const [portaria, setPortaria] = useState<PortariaData>(
    portariaInicial ?? { reservas: '', no_show: '', passantes: '' }
  )
  const [desistencias, setDesistencias] = useState<Desistencia[]>(desistenciasIniciais ?? [])
  const [novoMotivo, setNovoMotivo] = useState('')
  const [salvandoPortaria, setSalvandoPortaria] = useState(false)
  const [salvandoDesist, setSalvandoDesist] = useState(false)
  const [erroPo, setErroPo] = useState('')

  const reservas = num(portaria.reservas)
  const no_show = num(portaria.no_show)
  const passantes = num(portaria.passantes)
  const resultado = reservas - no_show + passantes
  const taxa = reservas > 0 ? ((reservas - no_show) / reservas) * 100 : NaN

  const portariaExiste = Boolean(portariaInicial?.id || portaria.id)

  async function salvarPortaria() {
    setSalvandoPortaria(true); setErroPo('')
    const res = await fetch(`/api/relatorio-diario/${relatorioData}/registros/portaria`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit_id: unitId, reservas: portaria.reservas || null, no_show: portaria.no_show || null, passantes: portaria.passantes || null }),
    })
    if (res.ok) {
      const data = await res.json()
      setPortaria(prev => ({ ...prev, id: data.id }))
    } else {
      const { error } = await res.json()
      setErroPo(error ?? 'Erro ao salvar portaria.')
    }
    setSalvandoPortaria(false)
  }

  async function adicionarDesistencia() {
    if (!portariaExiste) { setErroPo('Salve os dados de portaria primeiro.'); return }
    setSalvandoDesist(true)
    const res = await fetch(`/api/relatorio-diario/${relatorioData}/registros/portaria`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit_id: unitId, motivo: novoMotivo || null }),
    })
    if (res.ok) {
      const item = await res.json()
      setDesistencias(prev => [...prev, item])
      setNovoMotivo('')
    }
    setSalvandoDesist(false)
  }

  async function removerDesistencia(id: string) {
    const res = await fetch(`/api/relatorio-diario/${relatorioData}/registros/portaria?unit_id=${unitId}&id=${id}&tipo=desistencia`, { method: 'DELETE' })
    if (res.ok) setDesistencias(prev => prev.filter(d => d.id !== id))
  }

  return (
    <RegistroColapsavel titulo="Portaria" count={desistencias.length}>
      {/* Entradas / calculado */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(['reservas', 'no_show', 'passantes'] as const).map(key => (
          <div key={key} className="space-y-1">
            <label className="text-xs font-medium text-ink-muted capitalize">{key.replace('_', '-')}</label>
            <input type="number" inputMode="numeric" min="0" value={portaria[key]}
              onChange={e => setPortaria(prev => ({ ...prev, [key]: e.target.value }))}
              disabled={disabled}
              className="w-full rounded-lg border border-edge bg-base px-3 py-2 text-sm text-ink focus:border-ember focus:outline-none disabled:opacity-50" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-edge/50 bg-base p-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <span className="text-ink-muted">Resultado</span>
        <span className="text-ink font-medium text-right">{resultado} pax</span>
        <span className="text-ink-muted">Taxa de comparecimento</span>
        <span className="text-ink font-medium text-right">{isNaN(taxa) ? '—' : `${taxa.toFixed(1)}%`}</span>
      </div>

      {!disabled && (
        <>
          {erroPo && <p className="text-xs text-alert-bright">{erroPo}</p>}
          <button onClick={salvarPortaria} disabled={salvandoPortaria}
            className="w-full rounded-lg border border-edge bg-surface-raised px-3 py-2 text-sm font-medium text-ink hover:bg-surface transition-colors disabled:opacity-50">
            {salvandoPortaria ? 'Salvando…' : 'Salvar portaria'}
          </button>
        </>
      )}

      {/* Desistências */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Desistências ({desistencias.length})</p>
        {desistencias.map(d => (
          <div key={d.id} className="flex items-center justify-between rounded-lg border border-edge bg-base px-3 py-2">
            <span className="text-sm text-ink">{d.motivo ?? '(sem motivo)'}</span>
            {!disabled && (
              <button onClick={() => removerDesistencia(d.id)} className="text-ink-faint hover:text-alert transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {!disabled && (
          <div className="flex gap-2">
            <input type="text" value={novoMotivo} onChange={e => setNovoMotivo(e.target.value)}
              placeholder="Motivo da desistência (opcional)"
              className="flex-1 rounded-lg border border-edge bg-base px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-ember focus:outline-none" />
            <button onClick={adicionarDesistencia} disabled={salvandoDesist}
              className="rounded-lg border border-edge bg-surface-raised px-3 py-2 text-sm font-medium text-ink hover:bg-surface transition-colors disabled:opacity-50">
              {salvandoDesist ? '…' : '+'}
            </button>
          </div>
        )}
      </div>
    </RegistroColapsavel>
  )
}
