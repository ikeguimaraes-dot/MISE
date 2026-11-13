import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getMiseSession } from '@/lib/session'
import { isUuid } from '@/lib/business-registration'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getMiseSession()) return NextResponse.json({ error: 'Sua sessão expirou. Entre novamente.' }, { status: 401 })
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Etiqueta inválida.' }, { status: 400 })
  let body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 }) }
  if (!body || !['consumida', 'descartada'].includes(body.status)) return NextResponse.json({ error: 'Selecione usado no preparo ou perda.' }, { status: 400 })
  const db = createServiceClient()
  const result = await db.schema('mise').from('labels').update({ status: body.status }).eq('id', id).in('status', ['ativa', 'vencida']).select('id,status,unit_id').maybeSingle()
  if (result.error) return NextResponse.json({ error: 'Não foi possível salvar a ação. Tente novamente.' }, { status: 400 })
  if (result.data) return NextResponse.json({ label: result.data, changed: true })
  const current = await db.schema('mise').from('labels').select('id,status,unit_id').eq('id', id).maybeSingle()
  if (current.error) return NextResponse.json({ error: 'Não foi possível confirmar o estado da etiqueta.' }, { status: 500 })
  if (!current.data) return NextResponse.json({ error: 'Etiqueta não encontrada.' }, { status: 404 })
  if (current.data.status === body.status) return NextResponse.json({ label: current.data, changed: false })
  return NextResponse.json({ error: 'Esta etiqueta já foi finalizada com outra ação. A lista será atualizada.', label: current.data }, { status: 409 })
}
