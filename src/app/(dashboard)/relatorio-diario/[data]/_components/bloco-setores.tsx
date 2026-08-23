'use client'
import { SETORES_AVALIACAO, type SetorAvaliacao } from '@/app/api/relatorio-diario/_schema'

export type AvaliacaoItem = { nota: number | null; obs: string }
export type AvaliacaoSetoresState = Record<SetorAvaliacao, AvaliacaoItem>

function notaCor(nota: number | null): string {
  if (nota === null) return 'border-edge text-ink-muted'
  if (nota <= 1) return 'border-alert bg-alert/10 text-alert-bright'
  if (nota <= 3) return 'border-warn bg-warn/10 text-warn-bright'
  return 'border-fresh bg-fresh/10 text-fresh-bright'
}

export function BlocoSetores({
  value,
  onChange,
  disabled,
  erros,
}: {
  value: AvaliacaoSetoresState
  onChange: (v: AvaliacaoSetoresState) => void
  disabled?: boolean
  erros?: Partial<Record<SetorAvaliacao, boolean>>
}) {
  return (
    <div className="rounded-xl border border-edge bg-surface p-5 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Avaliação dos Setores</p>
      {SETORES_AVALIACAO.map(setor => {
        const av = value[setor]
        const obsObrigatoria = av.nota !== null && av.nota <= 2
        const erroObs = erros?.[setor] && obsObrigatoria && !av.obs.trim()
        return (
          <div key={setor} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink">{setor}</span>
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onChange({
                      ...value,
                      [setor]: { ...av, nota: av.nota === n ? null : n },
                    })}
                    disabled={disabled}
                    className={`h-8 w-8 rounded-lg border text-sm font-semibold transition-colors ${
                      av.nota === n ? notaCor(n) : 'border-edge text-ink-muted hover:border-ink'
                    } disabled:opacity-50`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            {obsObrigatoria && (
              <textarea
                id={`setor-obs-${setor}`}
                value={av.obs}
                onChange={e => onChange({ ...value, [setor]: { ...av, obs: e.target.value } })}
                disabled={disabled}
                rows={2}
                placeholder={`Observação obrigatória para nota ${av.nota}…`}
                className={`w-full rounded-lg border px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-50 bg-base resize-none ${
                  erroObs ? 'border-alert focus:border-alert' : 'border-edge focus:border-ember'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
