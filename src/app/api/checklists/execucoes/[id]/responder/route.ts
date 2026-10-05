import {crivoExecution,crivoError} from '@/lib/crivo/access'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: execution_id } = await params
  let ctx;try{ctx=await crivoExecution(execution_id,true);if(ctx.execution.status==='concluido')return NextResponse.json({error:'Visita concluída.'},{status:409})}catch(error){return crivoError(error)}
  const body = await request.json()
  const { item_id, resposta, comentario, foto_url, nao_aplicavel } = body

  if (!item_id) {
    return NextResponse.json({ error: 'item_id é obrigatório' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .schema('mise')
    .from('checklist_responses')
.select('id,foto_url')
    .eq('execution_id', execution_id)
    .eq('item_id', item_id)
    .maybeSingle()

  const belongs=ctx.execution.crivo_snapshot ? ctx.execution.crivo_snapshot.items.some((i:{id:string})=>i.id===item_id) : !!(await supabase.schema('mise').from('checklist_template_items').select('id').eq('ativo',true).eq('id',item_id).eq('template_id',ctx.execution.template_id).maybeSingle()).data;
  if(!belongs)return NextResponse.json({error:'Item de outra visita.'},{status:403});
  const firstPhoto=existing ? await supabase.schema('mise').from('crivo_response_fotos').select('url').eq('response_id',existing.id).order('ordem').order('created_at').limit(1).maybeSingle() : {data:null,error:null};
  if(firstPhoto.error)return NextResponse.json({error:'Fotos indisponíveis.'},{status:503});
  const photo=firstPhoto.data?.url??foto_url??existing?.foto_url??null;
  if (existing) {
    const { error } = await supabase
      .schema('mise')
      .from('checklist_responses')
      .update({ resposta: resposta ?? null, comentario: comentario ?? null, foto_url: photo, nao_aplicavel: nao_aplicavel ?? false })
      .eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  } else {
    const { error } = await supabase
      .schema('mise')
      .from('checklist_responses')
      .insert({ execution_id, item_id, resposta: resposta ?? null, comentario: comentario ?? null, foto_url: photo, nao_aplicavel: nao_aplicavel ?? false })
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
