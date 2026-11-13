export type ValidityBucket = '' | 'vencidos' | 'hoje' | 'amanha' | 'tres_dias' | 'consumida' | 'descartada'
export type ValidityFilters = { unit: string; bucket: ValidityBucket; page: number }
export type ValidityCounts = Record<Exclude<ValidityBucket, ''>, number>
export type ValidityLabel = { id: string; unit_id: string; employee_id: string | null; nome: string; tipo: string; peso_kg: number | null; metodo_conservacao: string | null; validade: string; data_manipulacao: string; status: string; unit_name: string; employee_name: string | null }
export type ValidityData = { labels: ValidityLabel[]; units: { id: string; name: string; active?: boolean | null }[]; counts: ValidityCounts; total: number; page: number; totalPages: number; now: string }

export const VALIDITY_CARDS = [
  { key: 'vencidos', label: 'Vencidos', color: 'text-alert-bright', border: 'border-alert' },
  { key: 'hoje', label: 'Vencem hoje', color: 'text-warn-bright', border: 'border-warn' },
  { key: 'amanha', label: 'Amanhã', color: 'text-warn', border: 'border-warn' },
  { key: 'tres_dias', label: 'Depois de amanhã', color: 'text-info', border: 'border-info' },
  { key: 'consumida', label: 'Usado no preparo', color: 'text-fresh-bright', border: 'border-fresh' },
  { key: 'descartada', label: 'Perda', color: 'text-alert-bright', border: 'border-alert' },
] as const

export function startOfDaySP(now: Date, offsetDays = 0): string {
  const [year, month, day] = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + offsetDays, 3)).toISOString()
}

export function getValidityBucket(label: Pick<ValidityLabel, 'status' | 'validade'>, now: Date): string {
  if (label.status === 'consumida' || label.status === 'descartada') return label.status
  if (label.status === 'vencida' || new Date(label.validade) <= now) return 'vencidos'
  const expiration = new Date(label.validade).getTime()
  if (expiration < new Date(startOfDaySP(now, 1)).getTime()) return 'hoje'
  if (expiration < new Date(startOfDaySP(now, 2)).getTime()) return 'amanha'
  if (expiration < new Date(startOfDaySP(now, 3)).getTime()) return 'tres_dias'
  return 'ok'
}

export function applyConfirmedLabelAction(data: ValidityData, id: string, status: 'consumida' | 'descartada'): ValidityData {
  const row = data.labels.find(label => label.id === id)
  if (!row || !['ativa', 'vencida'].includes(row.status)) return data
  const oldBucket = getValidityBucket(row, new Date(data.now))
  const counts = { ...data.counts, [status]: data.counts[status] + 1 }
  if (oldBucket in counts) counts[oldBucket as keyof ValidityCounts] = Math.max(0, counts[oldBucket as keyof ValidityCounts] - 1)
  return { ...data, labels: data.labels.filter(label => label.id !== id), counts, total: Math.max(0, data.total - 1) }
}
