import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: execution_id } = await params
  const body = await request.json()
  const { item_id, resposta, comentario, foto_url, nao_aplicavel } = body
  console.log('[responder]', JSON.stringify({ item_id, foto_url, resposta, has_foto: foto_url != null }))

  if (!item_id) {
    return NextResponse.json({ error: 'item_id é obrigatório' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .schema('mise')
    .from('checklist_responses')
    .select('id')
    .eq('execution_id', execution_id)
    .eq('item_id', item_id)
    .maybeSingle()

  if (existing) {
    await supabase.schema('mise').from('debug_responder').insert({ execution_id, item_id, foto_url: foto_url ?? null, resposta: resposta ?? null, branch: 'update' })
    const { error } = await supabase
      .schema('mise')
      .from('checklist_responses')
      .update({ resposta: resposta ?? null, comentario: comentario ?? null, foto_url: foto_url ?? null, nao_aplicavel: nao_aplicavel ?? false })
      .eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  } else {
    await supabase.schema('mise').from('debug_responder').insert({ execution_id, item_id, foto_url: foto_url ?? null, resposta: resposta ?? null, branch: 'insert' })
    const { error } = await supabase
      .schema('mise')
      .from('checklist_responses')
      .insert({ execution_id, item_id, resposta: resposta ?? null, comentario: comentario ?? null, foto_url: foto_url ?? null, nao_aplicavel: nao_aplicavel ?? false })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // If turno item answered, update execution turno
  if (resposta?.valor && body.is_turno_item) {
    await supabase.schema('mise').from('checklist_executions')
      .update({ turno: resposta.valor })
      .eq('id', execution_id)
  }

  return NextResponse.json({ ok: true })
}
