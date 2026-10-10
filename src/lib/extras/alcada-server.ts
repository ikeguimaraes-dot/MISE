import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { calcWeeklyBudget, extraAlerts, weekDays, type Spend, type PendingExtra } from './alcada'

// These callers must authenticate and scope units before using the service client.
export async function loadWeeklyBudget(db: SupabaseClient, unitId: string, reference: string) {
  const days = weekDays(reference)
  const [metas, overrides, configs] = await Promise.all([
    db.from('metas_dia_semana').select('unit_id, competencia, dia_semana, meta').eq('unit_id', unitId).in('competencia', [...new Set(days.map(day => day.slice(0, 7)))]),
    db.from('metas_dia_override').select('unit_id, data, meta').eq('unit_id', unitId).gte('data', days[0]).lte('data', days[6]),
    db.from('op_extra_alcada').select('unit_id, percentual, vigente_desde').eq('unit_id', unitId).lte('vigente_desde', reference).order('vigente_desde', { ascending: false }).limit(2),
  ])
  for (const result of [metas, overrides, configs]) if (result.error) throw new Error('Não foi possível consultar as metas e a configuração de alçada.')
  const extras: Spend[] = []
  // Never silently truncate weekly spending to PostgREST's default row limit.
  for (let offset = 0; ; offset += 500) {
    const result = await db.schema('mise').from('extra_allowance_spend').select('id, unit_id, data_trabalho, total, status').eq('unit_id', unitId).gte('data_trabalho', days[0]).lte('data_trabalho', days[6]).order('id').range(offset, offset + 499)
    if (result.error) throw new Error('Não foi possível consultar o consumo da alçada.')
    extras.push(...(result.data ?? []))
    if ((result.data?.length ?? 0) < 500) break
  }
  const budget = calcWeeklyBudget(unitId, reference, { metas: metas.data ?? [], overrides: overrides.data ?? [], configs: configs.data ?? [], extras })
  // Seven calendar days before the month closes, check all weekday targets next month.
  const date = new Date(`${reference}T12:00:00Z`)
  const nextMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 12))
  if ((nextMonth.getTime() - date.getTime()) / 86400000 <= 7) {
    const competencia = nextMonth.toISOString().slice(0, 7)
    const next = await db.from('metas_dia_semana').select('dia_semana').eq('unit_id', unitId).eq('competencia', competencia)
    if (next.error) budget.avisos.push('Não foi possível verificar as metas do próximo mês.')
    else {
      const missing = 7 - new Set((next.data ?? []).map(row => row.dia_semana)).size
      if (missing) budget.avisos.push(`Meta do próximo mês (${competencia}) não cadastrada para ${missing} dia(s) da semana.`)
    }
  }
  return budget
}
export async function loadExtraAlerts(db: SupabaseClient, units: { id: string; name: string }[], reference: string, now = new Date()) {
  const configured = await db.from('op_extra_alcada').select('unit_id');
  if(configured.error) throw new Error('Configuração de Extras indisponível.');
  units = units.filter(u => configured.data.some(c => c.unit_id === u.id));
  const budgets = await Promise.all(units.map(async unit => ({ ...unit, budget: await loadWeeklyBudget(db, unit.id, reference) })))
  const requests: PendingExtra[] = []
  if (units.length) for (const source of ['op_extra_solicitacao', 'op_extra']) for (let offset = 0; ; offset += 500) {
    // Not limited to the selected/current week: old approvals must remain visible.
    let query = db.from(source).select('id, unit_id, data_trabalho, status, created_at, mise_stage_at, emergencial, mise_emergency_decision').in('unit_id', units.map(unit => unit.id)).or('status.not.in.(recusado,cancelado,pago),and(emergencial.eq.true,mise_emergency_decision.is.null,status.eq.pago)').order('id').range(offset, offset + 499)
    if (source === 'op_extra') query = query.is('solicitacao_id', null)
    const result = await query
    if (result.error) throw new Error('Não foi possível consultar as solicitações pendentes de Extras.')
    requests.push(...(result.data ?? []).map(item=>({...item,request_kind: source === 'op_extra_solicitacao' ? 'positions' as const : 'person' as const,created_at:item.mise_stage_at??item.created_at})))
    if ((result.data?.length ?? 0) < 500) break
  }
  return { alerts: extraAlerts(budgets, requests, now), warnings: budgets.flatMap(unit => unit.budget.avisos.map(warning => `${unit.name}: ${warning}`)) }
}
