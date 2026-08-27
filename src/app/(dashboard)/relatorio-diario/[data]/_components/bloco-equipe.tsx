'use client'
import { Plus, X } from 'lucide-react'
import { SETORES_EQUIPE, type SetorEquipe } from '@/app/api/relatorio-diario/_schema'
import { SeletorColaborador, type Colaborador } from './seletor-colaborador'

export type EquipeSetorState = { houveFalta: boolean; nomes: string[] }
export type EquipeState = Record<SetorEquipe, EquipeSetorState>

export function BlocoEquipe({
  value,
  onChange,
  disabled,
  colaboradores,
}: {
  value: EquipeState
  onChange: (v: EquipeState) => void
  disabled?: boolean
  colaboradores: Colaborador[]
}) {
  return (
    <div className="rounded-xl border border-edge bg-surface p-5 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Equipe</p>
      {SETORES_EQUIPE.map(setor => {
        const estado = value[setor]
        return (
          <div key={setor} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink">{setor}</span>
              <div className="flex gap-2">
                {/* Toggle INVERTIDO: Não = verde (sem falta = bom), Sim = vermelho */}
                {(['Não', 'Sim'] as const).map(label => {
                  const houve = label === 'Sim'
                  const ativo = estado.houveFalta === houve
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => onChange({
                        ...value,
                        [setor]: {
                          houveFalta: houve,
                          nomes: houve ? [''] : [''],
                        },
                      })}
                      disabled={disabled}
                      className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
                        ativo && !houve
                          ? 'bg-fresh/20 text-fresh-bright border border-fresh/40'
                          : ativo && houve
                          ? 'bg-alert/10 text-alert-bright border border-alert/40'
                          : 'border border-edge text-ink-muted hover:text-ink'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {estado.houveFalta ? (
              /* Sim → campos de nomes dos ausentes */
              <div className="space-y-2 pl-1">
                {estado.nomes.map((nome, i) => (
                  <div key={i} className="flex gap-2">
                    <div className="flex-1">
                      <SeletorColaborador
                        colaboradores={colaboradores}
                        value={nome}
                        onChange={v => {
                          const nomes = [...estado.nomes]
                          nomes[i] = v
                          onChange({ ...value, [setor]: { ...estado, nomes } })
                        }}
                        disabled={disabled}
                        placeholder={`Ausente ${i + 1}`}
                        className="w-full rounded-lg border border-alert/30 bg-base px-3 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-alert focus:outline-none disabled:opacity-50"
                      />
                    </div>
                    {estado.nomes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onChange({
                          ...value,
                          [setor]: { ...estado, nomes: estado.nomes.filter((_, j) => j !== i) },
                        })}
                        disabled={disabled}
                        className="rounded-lg p-1.5 text-ink-muted hover:text-alert transition-colors disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => onChange({
                    ...value,
                    [setor]: { ...estado, nomes: [...estado.nomes, ''] },
                  })}
                  disabled={disabled}
                  className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar ausente
                </button>
              </div>
            ) : (
              /* Não → campo único para líder (opcional) */
              <SeletorColaborador
                colaboradores={colaboradores}
                value={estado.nomes[0] ?? ''}
                onChange={v => onChange({
                  ...value,
                  [setor]: { ...estado, nomes: [v] },
                })}
                disabled={disabled}
                placeholder={`Líder de ${setor} (opcional)`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
