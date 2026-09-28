import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireMiseRole } from '@/lib/session'

export async function GET() {
  const actor = await requireMiseRole(['admin'])
  if (!actor) {
    return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 })
  }

  const supabase = createServiceClient()
  const { data } = await supabase
    .schema('mise')
    .from('user_pins')
    .select('employee_id, role')
  return NextResponse.json(data ?? [])
}
