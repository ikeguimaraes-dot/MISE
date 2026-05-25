import { cookies } from 'next/headers'
import { createServiceClient } from './supabase/server'

export type MiseSession = {
  sessionId: string
  employeeId: string
  employeeName: string
  role: 'admin' | 'gerente' | 'cozinheiro'
}

export async function getMiseSession(): Promise<MiseSession | null> {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('mise-session')?.value
  if (!sessionId) return null

  const supabase = createServiceClient()
  const { data: session } = await supabase
    .schema('mise')
    .from('sessions')
    .select('id, employee_id, role, expires_at')
    .eq('id', sessionId)
    .single()

  if (!session) return null
  if (new Date(session.expires_at) < new Date()) return null

  const { data: employee } = await supabase
    .from('employees')
    .select('nome')
    .eq('id', session.employee_id)
    .single()

  return {
    sessionId: session.id,
    employeeId: session.employee_id,
    employeeName: employee?.nome ?? 'Funcionário',
    role: session.role as 'admin' | 'gerente' | 'cozinheiro',
  }
}
