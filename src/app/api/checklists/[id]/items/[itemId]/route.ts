import { getMiseSession } from '@/lib/session'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const actorSession=await getMiseSession();if(!actorSession || actorSession.role!=='admin')return NextResponse.json({error:'Acesso restrito.'},{status:actorSession?403:401})
  const { id, itemId } = await params
  const body = await request.json()
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .schema('mise')
    .from('checklist_template_items')
    .update(Object.fromEntries(Object.entries(body).filter(([k])=>!["id","template_id"].includes(k))))
    .eq('id', itemId).eq('template_id',id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ item: data })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const actorSession=await getMiseSession();if(!actorSession || actorSession.role!=='admin')return NextResponse.json({error:'Acesso restrito.'},{status:actorSession?403:401})
  const { id, itemId } = await params
  const supabase = createServiceClient()

  const { error } = await supabase
    .schema('mise')
    .from('checklist_template_items')
    .update({ativo:false})
    .eq('id', itemId).eq('template_id',id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
