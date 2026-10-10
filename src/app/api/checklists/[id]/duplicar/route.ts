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
    .insert({ ...templateFields, nome: `Cópia de ${original.nome}`, ativo:false })
    .select('id')
    .single()

  if (insertErr || !newTemplate) {
    return NextResponse.json({ error: insertErr?.message ?? 'Erro ao duplicar.' }, { status: 400 })
  }

  const { data: items, error: itemsError } = await supabase
    .schema('mise')
    .from('checklist_template_items')
    .select('*').eq('ativo',true)
    .eq('template_id', id)
    .order('ordem')

  if(itemsError)return NextResponse.json({error:"A cópia ficou inativa: itens indisponíveis."},{status:503});
  if (items && items.length > 0) {
    const newItems = items.map(({ id: _iid, created_at: _ica, ...rest }) => ({
      ...rest,
      template_id: newTemplate.id,
    }))
    const saved=await supabase.schema('mise').from('checklist_template_items').insert(newItems);
    if(saved.error)return NextResponse.json({error:'A cópia ficou inativa: falha ao copiar os itens.'},{status:503});
  }

  const topics=await supabase.schema('mise').from('checklist_template_topicos').select('topico_ordem,topico_nome,peso').eq('template_id',id).eq('ativo',true);
  if(topics.error)return NextResponse.json({error:'A cópia ficou inativa: pesos indisponíveis.'},{status:503});
  if(topics.data.length){const saved=await supabase.schema('mise').from('checklist_template_topicos').insert(topics.data.map(t=>({...t,template_id:newTemplate.id})));if(saved.error)return NextResponse.json({error:'A cópia ficou inativa: falha ao copiar pesos.'},{status:503});}
  const activated=await supabase.schema('mise').from('checklist_templates').update({ativo:original.ativo}).eq('id',newTemplate.id);
  if(activated.error)return NextResponse.json({error:'A cópia está inativa; confira a origem do questionário.'},{status:409});
  return NextResponse.json({ id: newTemplate.id }, { status: 201 })
}
