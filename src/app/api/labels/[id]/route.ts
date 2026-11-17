import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getMiseSession } from '@/lib/session'
import { requestedLabelExpiry } from '@/lib/label-expiry'
import { isUuid } from '@/lib/business-registration'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getMiseSession()
  if (!actor) return NextResponse.json({ error: 'Sua sessão expirou. Entre novamente.' }, { status: 401 })
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Etiqueta inválida.' }, { status: 400 })
  let body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 }) }
  if (body && ('validade_manual' in body || 'prazo_horas' in body)) {
    if (actor.role !== 'admin') return NextResponse.json({ error: 'Somente administradores podem alterar a validade.' }, { status: 403 })
    if (Object.keys(body).some(key => !['validade_manual', 'prazo_horas'].includes(key))) return NextResponse.json({ error: 'Envie apenas a validade ou o prazo em horas.' }, { status: 400 })
    const db = createServiceClient()
    const current = await db.schema('mise').from('labels').select('id,validade,validade_original,data_manipulacao,validade_fornecedor,status').eq('id', id).maybeSingle()
    if (current.error) return NextResponse.json({ error: 'Não foi possível consultar a etiqueta.' }, { status: 500 })
    if (!current.data) return NextResponse.json({ error: 'Etiqueta não encontrada.' }, { status: 404 })
    if (!['ativa', 'vencida'].includes(current.data.status)) return NextResponse.json({ error: 'Etiquetas finalizadas não podem ter a validade alterada.' }, { status: 409 })
    let validade: string
    try {
      validade = requestedLabelExpiry({ manipulation: current.data.data_manipulacao, baseHours: 0, hours: body.prazo_horas, manualExpiry: body.validade_manual, admin: true, supplierExpiry: current.data.validade_fornecedor })
    } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Validade inválida.' }, { status: 400 }) }
    const updated = await db.schema('mise').from('labels').update({ validade, validade_original: current.data.validade_original || current.data.validade, validade_alterada_por: actor.employeeId, validade_alterada_em: new Date().toISOString(), status: new Date(validade).getTime() <= Date.now() ? 'vencida' : 'ativa' }).eq('id', id).eq('validade', current.data.validade).in('status', ['ativa', 'vencida']).select('id,validade,status').maybeSingle()
    if (updated.error) return NextResponse.json({ error: 'Não foi possível alterar a validade.' }, { status: 500 })
    if (!updated.data) return NextResponse.json({ error: 'A etiqueta foi alterada por outra pessoa. Atualize a lista.' }, { status: 409 })
    return NextResponse.json({ label: updated.data })
  }
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
