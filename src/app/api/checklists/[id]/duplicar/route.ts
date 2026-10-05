import { getMiseSession } from '@/lib/session'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const actorSession=await getMiseSession();if(!actorSession || actorSession.role!=='admin')return NextResponse.json({error:'Acesso restrito.'},{status:actorSession?403:401})
  const { id } = await params
  const supabase = createServiceClient()

  const { data: original, error: tErr } = await supabase
    .schema('mise')
    .from('checklist_templates')
    .select('*')
    .eq('id', id)
    .single()

  if (tErr || !original) {
    return NextResponse.json({ error: 'Template não encontrado.' }, { status: 404 })
  }

  const { id: _id, created_at: _ca, ...templateFields } = original
  const { data: newTemplate, error: insertErr } = await supabase
    .schema('mise')
    .from('checklist_templates')
    .insert({ ...templateFields, nome: `Cópia de ${original.nome}` })
    .select('id')
    .single()

  if (insertErr || !newTemplate) {
    return NextResponse.json({ error: insertErr?.message ?? 'Erro ao duplicar.' }, { status: 400 })
  }

  const { data: items } = await supabase
    .schema('mise')
    .from('checklist_template_items')
    .select('*')
    .eq('template_id', id)
    .order('ordem')

  if (items && items.length > 0) {
    const newItems = items.map(({ id: _iid, created_at: _ica, ...rest }) => ({
      ...rest,
      template_id: newTemplate.id,
    }))
    await supabase.schema('mise').from('checklist_template_items').insert(newItems)
  }

  return NextResponse.json({ id: newTemplate.id }, { status: 201 })
}
