import {crivoExecution,crivoError} from '@/lib/crivo/access'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const execution_id = formData.get('execution_id') as string | null
  const item_id = formData.get('item_id') as string | null

  if (!file || !execution_id || !item_id) {
    return NextResponse.json({ error: 'file, execution_id e item_id são obrigatórios' }, { status: 400 })
  }

  try {const ctx=await crivoExecution(execution_id,true);if(ctx.execution.status==='concluido')return NextResponse.json({error:'Visita concluída.'},{status:409});const item=await ctx.db.schema('mise').from('checklist_template_items').select('id').eq('template_id',ctx.execution.template_id).eq('id',item_id).single();if(item.error)return NextResponse.json({error:'Item inválido.'},{status:400})} catch(error){return crivoError(error)}
  if(!(file instanceof File)||file.size<1||file.size>4194304)return NextResponse.json({error:'Envie PNG ou JPEG até 4 MB.'},{status:400})
  const bytes=new Uint8Array(await file.arrayBuffer());const ext=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'jpg':null
  if(!ext || file.type!==(ext==='png'?'image/png':'image/jpeg'))return NextResponse.json({error:'Formato de imagem inválido.'},{status:400})
  const timestamp = Date.now()
  const path = `${execution_id}/${item_id}/${timestamp}.${ext}`

  const supabase = createServiceClient()
  const { error: uploadError } = await supabase.storage
    .from('checklist-photos')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 })
  }

  const { data: { publicUrl } } = supabase.storage
    .from('checklist-photos')
    .getPublicUrl(path)

  return NextResponse.json({ url: publicUrl })
}
