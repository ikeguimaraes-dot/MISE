import { getMiseSession } from '@/lib/session'
import { createServiceClient } from '@/lib/supabase/server'

export type AuthResult =
  | { ok: true; employeeId: string; role: 'admin' | 'gerente' }
  | { ok: false; status: 401 | 403; message: string }

export async function canAccessUnit(unitId: string): Promise<AuthResult> {
  const session = await getMiseSession()
  if (!session) return { ok: false, status: 401, message: 'Não autenticado.' }

  if (session.role === 'cozinheiro') {
    return { ok: false, status: 403, message: 'Cozinheiros não têm acesso ao relatório diário.' }
  }

  // Revalidate active employee even when the session has an administrative role.
  const supabase = createServiceClient()
  const { data: emp } = await supabase
    .from('employees')
    .select('unit_id,ativo')
    .eq('id', session.employeeId)
    .single()

  if (!emp?.ativo || (session.role !== 'admin' && emp.unit_id !== unitId)) {
    return { ok: false, status: 403, message: 'Sem permissão para esta unidade.' }
  }

  return { ok: true, employeeId: session.employeeId, role: session.role }
}
