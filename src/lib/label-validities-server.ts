import { createServiceClient } from '@/lib/supabase/server'
import { startOfDaySP, type ValidityBucket, type ValidityData, type ValidityFilters } from '@/lib/label-validities'

const LABEL_FIELDS = 'id,unit_id,employee_id,responsavel_nome,nome,tipo,peso_kg,metodo_conservacao,validade,data_manipulacao,status'

export async function loadValidities(filters: ValidityFilters, now = new Date()): Promise<ValidityData> {
  const db = createServiceClient()
  const current = now.toISOString()
  function queryFor(bucket: ValidityBucket, head = false) {
    let query = db.schema('mise').from('labels').select(head ? 'id' : LABEL_FIELDS, { count: 'exact', head })
    if (filters.unit) query = query.eq('unit_id', filters.unit)
    if (bucket === 'consumida' || bucket === 'descartada') return query.eq('status', bucket)
    if (bucket === 'vencidos') return query.in('status', ['ativa', 'vencida']).or(`status.eq.vencida,validade.lte.${current}`)
    if (bucket === 'hoje') return query.eq('status', 'ativa').gt('validade', current).lt('validade', startOfDaySP(now, 1))
    if (bucket === 'amanha') return query.eq('status', 'ativa').gte('validade', startOfDaySP(now, 1)).lt('validade', startOfDaySP(now, 2))
    if (bucket === 'tres_dias') return query.eq('status', 'ativa').gte('validade', startOfDaySP(now, 2)).lt('validade', startOfDaySP(now, 3))
    return query.in('status', ['ativa', 'vencida'])
  }
  const keys = ['vencidos', 'hoje', 'amanha', 'tres_dias', 'consumida', 'descartada'] as const
  const rowQuery = (page: number) => queryFor(filters.bucket).order('validade', { ascending: !['consumida', 'descartada'].includes(filters.bucket) }).order('id').range((page - 1) * 20, page * 20 - 1)
  const [initialRows, units, ...countResults] = await Promise.all([rowQuery(filters.page), db.from('units').select('id,name,active').order('name'), ...keys.map(key => queryFor(key, true))])
  if (initialRows.error || units.error || countResults.some(result => result.error)) throw new Error('Não foi possível carregar as validades. Tente novamente.')
  const total = initialRows.count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / 20))
  const page = Math.min(filters.page, totalPages)
  const rowResult = page === filters.page ? initialRows : await rowQuery(page)
  if (rowResult.error) throw new Error('Não foi possível carregar as etiquetas.')
  // O select dinâmico é constante neste módulo; não depende de nomes de campos enviados pelo cliente.
  const rows = (rowResult.data ?? []) as unknown as (Omit<ValidityData['labels'][number], 'unit_name' | 'employee_name'> & { responsavel_nome: string | null })[]
  const employeeIds = [...new Set(rows.map(row => row.employee_id).filter(Boolean))] as string[]
  const employees = employeeIds.length ? await db.from('employees').select('id,nome').in('id', employeeIds) : { data: [], error: null }
  if (employees.error) throw new Error('Não foi possível carregar os responsáveis.')
  const unitNames = new Map((units.data ?? []).map(unit => [unit.id, unit.name]))
  const employeeNames = new Map((employees.data ?? []).map(employee => [employee.id, employee.nome]))
  return {
    labels: rows.map(row => ({ ...row, unit_name: unitNames.get(row.unit_id) ?? '—', employee_name: row.responsavel_nome || (row.employee_id ? employeeNames.get(row.employee_id) ?? null : null) })),
    units: units.data ?? [], counts: Object.fromEntries(keys.map((key, index) => [key, countResults[index].count ?? 0])) as ValidityData['counts'],
    total, page, totalPages, now: current,
  }
}
