import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { requireMiseRole } from '@/lib/session'

export async function POST(request: Request) {
  const actor = await requireMiseRole(['admin'])
  if (!actor) {
    return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 })
  }

  const { employee_id, pin, role } = await request.json()

  const allowedRoles = ['cozinheiro', 'gerente', 'admin'] as const
  if (!employee_id || !pin || !/^\d{4}$/.test(String(pin)) || !allowedRoles.includes(role)) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  const pin_hash = await bcrypt.hash(String(pin), 10)
  const supabase = createServiceClient()

  const { error } = await supabase
    .schema('mise')
    .from('user_pins')
    .upsert(
      { employee_id, pin_hash, role, updated_at: new Date().toISOString() },
      { onConflict: 'employee_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
