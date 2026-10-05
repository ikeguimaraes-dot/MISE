'use client'
import { useEffect, useState } from 'react'
import { calcWeeklyBudget, usageLevel, type WeeklyBudget } from '../../lib/extras/alcada'
import { money } from './model'
export type BudgetUnit = { id: string; name: string }
export const DEMO_UNITS: BudgetUnit[] = ['Meet & Eat', 'Frêneze', 'Madonna SP Itaim', 'Match Point', 'HOS'].map(name => ({ id: name, name }))
// Explicit fixtures for local review only; never used as a production fallback.
const DEMO_WEEKLY_TARGETS: Record<string, number> = Object.fromEntries(DEMO_UNITS.filter(unit => unit.name !== 'HOS').map((unit, index) => [unit.name, 200000 * (index + 1)]))
export function demoBudget(unit: string, day: string): WeeklyBudget {
  const target = DEMO_WEEKLY_TARGETS[unit]
  const metas = target === undefined ? [] : ['2026-09', '2026-10'].flatMap(competencia => Array.from({ length: 7 }, (_, dia_semana) => ({ unit_id: unit, competencia, dia_semana, meta: dia_semana === 0 ? target - Math.floor(target / 7) * 6 : Math.floor(target / 7) })))
  return calcWeeklyBudget(unit, day, { metas, overrides: [], configs: target === undefined ? [] : [{ unit_id: unit, percentual: 1, vigente_desde: '2026-09-01' }], extras: [] })
}
export function useWeeklyBudget(unit: BudgetUnit | undefined, day: string, mode: 'local' | 'review') {
  const key = `${unit?.id ?? ''}|${day}`
  const [state, setState] = useState<{ key: string; budget?: WeeklyBudget; error?: string }>({ key: '' })
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!unit || !day || mode === 'local') return
    const controller = new AbortController()
    setState({ key })
    fetch(`/api/extras/alcada?unit_id=${encodeURIComponent(unit.id)}&data=${encodeURIComponent(day)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Alçada indisponível.'); return body as WeeklyBudget })
      .then(budget => { if (!controller.signal.aborted) setState({ key, budget }) })
      .catch(error => { if (!controller.signal.aborted) setState({ key, error: error instanceof Error ? error.message : 'Alçada indisponível.' }) })
    return () => controller.abort()
  }, [key, unit?.id, day, mode, revision]) // eslint-disable-line react-hooks/exhaustive-deps
  if (mode === 'local' && unit && day) return { budget: demoBudget(unit.name, day), error: undefined, loading: false, retry: () => {} }
  const current = state.key === key ? state : undefined
  return { budget: current?.budget, error: current?.error, loading: !!unit && !current?.budget && !current?.error, retry: () => setRevision(value => value + 1) }
}
export function budgetWithSimulation(base: WeeklyBudget, simulated: number): WeeklyBudget {
  return { ...base, gasto: base.gasto + simulated, saldo: base.teto - base.gasto - simulated }
}
export function WeeklyBudgetCard({ budget, realSpend, unit, loading, error, retry, local }: { budget?: WeeklyBudget; realSpend: number; unit: string; loading: boolean; error?: string; retry: () => void; local: boolean }) {
  if (!budget) return <section className="ex-weekly" aria-label="Alçada semanal" aria-busy={loading}><strong>Alçada semanal · {unit}</strong><p role="status">{error || (loading ? 'Consultando metas e consumo…' : 'Selecione uma unidade para consultar sua alçada.')}</p>{error && <button className="ex-secondary" onClick={retry}>Tentar novamente</button>}</section>
  const level = usageLevel(budget)
  const date = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`
  return <section className={`ex-weekly is-${level.tone}`} aria-label="Alçada semanal">
    <div className="ex-weekly-heading"><strong>Semana {date(budget.segunda)}–{date(budget.domingo)} · {unit}</strong><small>{local ? 'Metas demonstrativas' : 'Metas cadastradas'} · {budget.percentual === null ? 'percentual pendente' : `${budget.percentual.toLocaleString('pt-BR')}%`} · sem acúmulo</small></div>
    <div className="ex-weekly-values"><span>Alçada <b>{money(budget.teto)}</b></span><span>Usado + testes <b>{money(budget.gasto)}</b></span><span>Saldo projetado <b>{money(budget.saldo)}</b></span></div>
    <div className="ex-weekly-progress"><div role="progressbar" aria-label="Consumo da alçada semanal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, level.percentage ?? 100)} aria-valuetext={level.percentage === null ? 'Sem alçada disponível; há consumo' : `${level.percentage}% da alçada`}><span style={{ width: `${level.width}%` }} /></div><b>{level.percentage === null ? 'Sem teto disponível' : `${level.percentage}%`}</b></div>
    <small>Registrado no banco: {money(realSpend)} · Testes neste navegador: {money(budget.gasto - realSpend)}. A simulação não consome a alçada real.</small>
    {budget.saldo < 0 && <p className="ex-weekly-warning" role="status">Atenção · alçada semanal estourada em {money(-budget.saldo)} nesta projeção.</p>}
    {budget.avisos.map(warning => <p className="ex-weekly-warning" role="status" key={warning}>{warning}</p>)}
  </section>
}
