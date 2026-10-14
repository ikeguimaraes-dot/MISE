import {crivoContext,crivoError} from '@/lib/crivo/access'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const unit_id = searchParams.get('unit_id')
  const status = searchParams.get('status')
  const template_id = searchParams.get('template_id')

  let ctx;try{ctx=await crivoContext()}catch(e){return crivoError(e)}
  if(ctx.session.role!=="admin" && (!ctx.unitId || unit_id && unit_id!==ctx.unitId))return NextResponse.json({error:"Sem acesso à unidade."},{status:403});
  const supabase=ctx.db
  let query = supabase.schema('mise').from('checklist_executions').select('id,template_id,unit_id,turno,status,iniciado_em,concluido_em,percentual,local_id')
  if(ctx.session.role!=='admin')query=query.eq('unit_id',ctx.unitId);
  else if (unit_id) query = query.eq('unit_id', unit_id)
  if(ctx.session.role==='cozinheiro'){
    const allowed=await supabase.schema('mise').from('checklist_templates').select('id').eq('modulo','RITMO');
    if(allowed.error)return NextResponse.json({error:'Templates indisponíveis.'},{status:503});
    query=query.in('template_id',allowed.data.map(t=>t.id));
  }
  if (status) query = query.eq('status', status)
  if (template_id) query = query.eq('template_id', template_id)

  const { data, error } = await query.order('iniciado_em', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ execucoes: data ?? [] })
}

export async function POST(request: Request) {
  const body = await request.json()
  if (!body.template_id) {
    return NextResponse.json({ error: 'template_id é obrigatório' }, { status: 400 })
  }
  let ctx
  try{ctx=await crivoContext()}catch(error){return crivoError(error)}
  const supabase=ctx.db
  const {data: template}=await supabase.schema('mise').from('checklist_templates').select('unit_id,ativo,modulo').eq('id',body.template_id).single()
  if(!template?.ativo || template.modulo==='CRIVO'&&ctx.session.role!=='admin')return NextResponse.json({error:'Template indisponível.'},{status:403})
  const unitId=body.unit_id??ctx.unitId
  if(!unitId || ctx.session.role!=='admin'&&(unitId!==ctx.unitId || template.unit_id&&template.unit_id!==ctx.unitId))return NextResponse.json({error:'Sem acesso à unidade.'},{status:403})
  const { data, error } = await supabase
    .schema('mise')
    .from('checklist_executions')
    .insert({
      template_id: body.template_id,
      unit_id: unitId,
      turno: body.turno ?? null,
      status: 'em_andamento',
    })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}
