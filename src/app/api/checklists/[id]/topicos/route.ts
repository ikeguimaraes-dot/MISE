import { getMiseSession } from '@/lib/session'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const actorSession=await getMiseSession();if(!actorSession || actorSession.role!=='admin')return NextResponse.json({error:'Acesso restrito.'},{status:actorSession?403:401})
  const { id: template_id } = await params
  const body = await request.json()

  if (!body.topico_nome?.trim()) {
    return NextResponse.json({ error: 'topico_nome é obrigatório' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .schema('mise').from('checklist_template_topicos')
    .select('topico_ordem')
    .eq('template_id', template_id)
    .order('topico_ordem', { ascending: false })
    .limit(1)

  const nextOrdem = (existing?.[0]?.topico_ordem ?? 0) + 1

  const { data, error } = await supabase
    .schema('mise').from('checklist_template_topicos')
    .insert({
      template_id,
      topico_ordem: nextOrdem,
      topico_nome: body.topico_nome.trim(),
      peso: body.peso ?? 0,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ topico: data }, { status: 201 })
}
