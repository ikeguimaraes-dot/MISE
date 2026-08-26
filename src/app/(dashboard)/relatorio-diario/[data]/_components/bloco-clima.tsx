'use client'
import { TEMPO_OPCOES, type TempoOpcao } from '@/app/api/relatorio-diario/_schema'

export type ClimaState = { tempo: string; temperatura: string }

export function BlocoClima({
  value,
  onChange,
  disabled,
}: {
  value: ClimaState
  onChange: (v: ClimaState) => void
  disabled?: boolean
}) {
  return (
    <div className="rounded-xl border border-edge bg-surface p-5 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Clima</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-muted">Tempo</label>
          <select
            value={value.tempo}
            onChange={e => onChange({ ...value, tempo: e.target.value })}
            disabled={disabled}
            className="w-full rounded-lg border border-edge bg-base px-3 py-2 text-sm text-ink focus:border-ember focus:outline-none disabled:opacity-50"
          >
            <option value="">Selecionar…</option>
            {TEMPO_OPCOES.map((t: TempoOpcao) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-muted">Temperatura (°C)</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            value={value.temperatura}
            onChange={e => onChange({ ...value, temperatura: e.target.value })}
            disabled={disabled}
            placeholder="ex: 28"
            className="w-full rounded-lg border border-edge bg-base px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-ember focus:outline-none disabled:opacity-50"
          />
        </div>
      </div>
    </div>
  )
}
