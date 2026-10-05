import { getMiseSession } from '@/lib/session'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type TopicoPayload = { topico_ordem: number; topico_nome: string; peso: number }
type ItemPayload = { id: string; ordem: number; topico_ordem: number | null; topico_nome: string | null }

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const actorSession=await getMiseSession();if(!actorSession || actorSession.role!=='admin')return NextResponse.json({error:'Acesso restrito.'},{status:actorSession?403:401})
  const { id: template_id } = await params
  const body = await request.json()
  const topicos: TopicoPayload[] = body.topicos ?? []
  const itens: ItemPayload[] = body.itens ?? []

  const supabase = createServiceClient()

  // Replace all topicos: delete + insert
  const { error: delError } = await supabase
    .schema('mise').from('checklist_template_topicos')
    .delete()
    .eq('template_id', template_id)

  if (delError) return NextResponse.json({ error: delError.message }, { status: 400 })

  if (topicos.length > 0) {
    const { error: insError } = await supabase
      .schema('mise').from('checklist_template_topicos')
      .insert(topicos.map(t => ({
        template_id,
        topico_ordem: t.topico_ordem,
        topico_nome: t.topico_nome,
        peso: t.peso,
      })))

    if (insError) return NextResponse.json({ error: insError.message }, { status: 400 })
  }

  // Batch update all items
  if (itens.length > 0) {
    const { error: itemError } = await supabase
      .schema('mise').from('checklist_template_items')
      .upsert(
        itens.map(i => ({
          id: i.id,
          ordem: i.ordem,
          topico_ordem: i.topico_ordem,
          topico_nome: i.topico_nome,
        })),
        { onConflict: 'id' }
      )

    if (itemError) return NextResponse.json({ error: itemError.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
