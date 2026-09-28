import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import {
  checkPinRateLimit,
  clearPinFailures,
  makePinRateKey,
  recordPinFailure,
} from '@/lib/security/pin-rate-limit'

export async function POST(request: Request) {
  let body: { employee_id?: unknown; pin?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido.' }, { status: 400 })
  }

  const employeeId = typeof body.employee_id === 'string' ? body.employee_id : ''
  const pin = String(body.pin ?? '')
  if (!employeeId || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: 'Campos obrigatorios.' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const key = await makePinRateKey(request, employeeId)
  const retryAfter = await checkPinRateLimit(supabase, key)
  if (retryAfter > 0) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Aguarde 15 minutos.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }
  const { data: pinRecord } = await supabase
    .schema('mise')
    .from('user_pins')
    .select('pin_hash, role')
    .eq('employee_id', employeeId)
    .single()

  if (!pinRecord || !(await bcrypt.compare(pin, pinRecord.pin_hash))) {
    await recordPinFailure(supabase, key)
    await new Promise((resolve) => setTimeout(resolve, 350))
    return NextResponse.json({ error: 'Credenciais invalidas.' }, { status: 401 })
  }
  await clearPinFailures(supabase, key)

  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
  const { data: session, error } = await supabase
    .schema('mise')
    .from('sessions')
    .insert({ employee_id: employeeId, role: pinRecord.role, expires_at: expiresAt })
    .select('id')
    .single()

  if (error || !session) {
    return NextResponse.json({ error: 'Erro ao criar sessao.' }, { status: 500 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('mise-session', session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 43200,
    path: '/',
  })
  return response
}
