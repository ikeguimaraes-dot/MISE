import { getMiseSession } from '@/lib/session'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function authorizeChecklistPhoto(executionId: string, itemId: string) {
  const session = await getMiseSession()
  if (!session) return { ok: false as const, status: 401 }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuid.test(executionId) || !uuid.test(itemId)) return { ok: false as const, status: 400 }
  const service = createServiceClient()
  const { data: employee } = await service.from('employees').select('unit_id,ativo').eq('id', session.employeeId).single()
  if (!employee?.ativo) return { ok: false as const, status: 403 }
  const { data: execution } = await service.schema('mise').from('checklist_executions')
    .select('id,unit_id,template_id,status').eq('id', executionId).single()
  if (!execution?.unit_id) return { ok: false as const, status: 404 }
  let allowed = employee.unit_id === execution.unit_id
  if (!allowed) {
    const userClient = await createClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (user) {
      const { data, error } = await userClient.rpc('kph_has_role_for_unit', { p_unit_id: execution.unit_id })
      allowed = !error && data === true
    }
  }
  if (!allowed) return { ok: false as const, status: 403 }
  const { data: item } = await service.schema('mise').from('checklist_template_items')
    .select('id').eq('id', itemId).eq('template_id', execution.template_id).single()
  if (!item) return { ok: false as const, status: 404 }
  return { ok: true as const, service, execution }
}
