// Money is represented in integer cents throughout this module.
export type Meta = { unit_id: string; competencia: string; dia_semana: number; meta: number | string }
export type Override = { unit_id: string; data: string; meta: number | string }
export type Config = { unit_id: string; percentual: number | string; vigente_desde: string }
export type Spend = { id?: string; unit_id: string; data_trabalho: string; total: number | string | null; status: string }
export type WeeklyBudget = {
  segunda: string; domingo: string; metaSemana: number; percentual: number | null; vigenteDesde: string | null;
  teto: number; gasto: number; saldo: number; diasSemMeta: string[]; avisos: string[];
}
export function validDate(day: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(`${day}T12:00:00Z`)) && new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) === day
}
export function weekDays(reference: string): string[] {
  if (!validDate(reference)) throw new Error('Data de referência inválida.')
  const d = new Date(`${reference}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7)
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(d); day.setUTCDate(d.getUTCDate() + index)
    return day.toISOString().slice(0, 10)
  })
}
export function cents(value: number | string | null): number {
  const n = Number(value ?? 0), result = Math.round(n * 100)
  if (!Number.isFinite(n) || n < 0 || !Number.isSafeInteger(result)) throw new Error('Valor monetário inválido na fonte de dados.')
  return result
}
export function calcWeeklyBudget(unitId: string, reference: string, source: { metas: Meta[]; overrides: Override[]; configs: Config[]; extras: Spend[] }): WeeklyBudget {
  const days = weekDays(reference)
  const diasSemMeta: string[] = []
  const metaSemana = days.reduce((sum, day) => {
    const override = source.overrides.find(row => row.unit_id === unitId && row.data === day)
    const meta = source.metas.find(row => row.unit_id === unitId && row.competencia === day.slice(0, 7) && row.dia_semana === new Date(`${day}T12:00:00Z`).getUTCDay())
    if (!override && !meta) diasSemMeta.push(day)
    return sum + cents(override ? override.meta : meta?.meta ?? 0)
  }, 0)
  // Effective on the work/reference date, never a future or hardcoded percentage.
  const versions = source.configs.filter(row => row.unit_id === unitId && row.vigente_desde <= reference).sort((a, b) => b.vigente_desde.localeCompare(a.vigente_desde))
  if (versions.length > 1 && versions[0].vigente_desde === versions[1].vigente_desde) throw new Error('Há mais de uma alçada com a mesma vigência. Revise a configuração.')
  const config = versions[0]
  const percentual = config ? Number(config.percentual) : null
  if (percentual !== null && (!Number.isFinite(percentual) || percentual < 0)) throw new Error('Percentual de alçada inválido.')
  const teto = Math.round(metaSemana * (percentual ?? 0) / 100)
  const gasto = source.extras.filter(row => row.unit_id === unitId && row.data_trabalho >= days[0] && row.data_trabalho <= days[6] && !['recusado', 'cancelado'].includes(row.status)).reduce((sum, row) => sum + cents(row.total), 0)
  if (![metaSemana, teto, gasto].every(Number.isSafeInteger)) throw new Error('Total fora do intervalo permitido.')
  const avisos: string[] = []
  const unknown = source.extras.filter(e => e.unit_id === unitId && e.data_trabalho >= days[0] && e.data_trabalho <= days[6] && e.total == null && !['cancelado','recusado'].includes(e.status)).length;
  if (unknown) avisos.push(`${unknown} solicitação(ões) com valor a definir. O saldo considera apenas os valores conhecidos.`);
  if (diasSemMeta.length) avisos.push(`Meta não cadastrada para ${diasSemMeta.length} dia(s) desta semana. Esses dias entram com R$ 0,00.`)
  if (!config) avisos.push('Percentual de alçada não cadastrado para esta data. Teto R$ 0,00; solicitações seguem para a diretoria.')
  return { segunda: days[0], domingo: days[6], metaSemana, percentual, vigenteDesde: config?.vigente_desde ?? null, teto, gasto, saldo: teto - gasto, diasSemMeta, avisos }
}
export function requestRoute(budget: WeeklyBudget, amount: number, emergency: boolean) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Informe o valor estimado positivo da solicitação.')
  const excesso = Math.max(0, budget.gasto + amount - budget.teto)
  return { status: !emergency && excesso > 0 ? 'aguardando_diretoria' as const : 'solicitado' as const, excesso, alertarDiretoria: emergency }
}
export function usageLevel(budget: Pick<WeeklyBudget, 'gasto' | 'teto'>) {
  const ratio = budget.teto > 0 ? budget.gasto / budget.teto : budget.gasto > 0 ? Infinity : 0
  return { percentage: Number.isFinite(ratio) ? Math.round(ratio * 100) : null, width: Math.min(100, ratio * 100), tone: ratio > 1 ? 'critical' : ratio > .8 ? 'warning' : 'normal' }
}
export type ExtraAlert = { id: string; modulo: 'EXTRAS'; unidade: string; severidade: 'atencao' | 'critico'; titulo: string; descricao: string; data: string; href: string }
export type PendingExtra = { request_kind?: 'positions' | 'person'; id: string; unit_id: string; data_trabalho: string; status: string; created_at: string; emergencial: boolean; mise_emergency_decision?: string | null }
const brl = (value: number) => (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export function extraAlerts(units: { id: string; name: string; budget: WeeklyBudget }[], requests: PendingExtra[], now: Date): ExtraAlert[] {
  const alerts: ExtraAlert[] = []
  for (const unit of units) {
    const b = unit.budget
    if (b.saldo < 0) alerts.push({ id: `extras-alcada-${unit.id}-${b.segunda}`, modulo: 'EXTRAS', unidade: unit.name, severidade: 'atencao', titulo: 'Alçada semanal estourada', descricao: `${brl(b.gasto)} usados de ${brl(b.teto)}. Excesso de ${brl(-b.saldo)} na semana ${b.segunda} a ${b.domingo}.`, data: b.segunda, href: `/extras?unit_id=${unit.id}&data=${b.segunda}` })
  }
  for (const item of requests) {
    const unit = units.find(row => row.id === item.unit_id)
    if (!unit || ['recusado', 'cancelado'].includes(item.status) || (item.status === 'pago' && (!item.emergencial || item.mise_emergency_decision))) continue
    const base = { modulo: 'EXTRAS' as const, unidade: unit.name, data: item.data_trabalho, href: `/extras?unit_id=${item.unit_id}&data=${item.data_trabalho}&${item.request_kind === 'positions' ? 'solicitacao_id' : 'extra_id'}=${item.id}` }
    if (item.status !== 'pago' && now.getTime() - Date.parse(item.created_at) > 86400000) alerts.push({ ...base, id: `extras-diretoria-${item.id}`, severidade: 'critico', titulo: item.status === 'aguardando_diretoria' ? 'Solicitação aguardando diretoria há mais de 24h' : 'Solicitação parada há mais de 24h', descricao: `Solicitação ${item.id}: decisão pendente desde ${new Date(item.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.` })
    if (item.emergencial && !item.mise_emergency_decision) alerts.push({ ...base, id: `extras-emergencia-${item.id}`, severidade: 'critico', titulo: 'Extra emergencial registrado', descricao: `Solicitação ${item.id}: exceção ao fluxo normal; requer acompanhamento da diretoria.` })
  }
  return alerts
}
