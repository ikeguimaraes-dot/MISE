'use client'

export type OcorrenciaState = { houve: boolean; descricao: string }

export function BlocoOcorrencia({
  value,
  onChange,
  disabled,
}: {
  value: OcorrenciaState
  onChange: (v: OcorrenciaState) => void
  disabled?: boolean
}) {
  return (
    <div className={`rounded-xl border p-5 space-y-3 ${
      value.houve ? 'border-alert bg-alert/5' : 'border-edge bg-surface'
    }`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Ocorrência</p>
        <div className="flex gap-2">
          {(['Não', 'Sim'] as const).map(label => {
            const houve = label === 'Sim'
            const ativo = value.houve === houve
            return (
              <button
                key={label}
                type="button"
                onClick={() => onChange({ ...value, houve })}
                disabled={disabled}
                className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                  ativo && houve
                    ? 'bg-alert text-white'
                    : ativo
                    ? 'bg-surface-raised text-ink border border-edge'
                    : 'text-ink-muted hover:text-ink border border-edge'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>
      {value.houve && (
        <textarea
          value={value.descricao}
          onChange={e => onChange({ ...value, descricao: e.target.value })}
          disabled={disabled}
          rows={3}
          placeholder="Descreva a ocorrência…"
          className="w-full rounded-lg border border-alert/40 bg-base px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-alert focus:outline-none disabled:opacity-50 resize-none"
        />
      )}
    </div>
  )
}
