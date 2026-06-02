import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const unit_id = searchParams.get('unit_id')

  const supabase = createServiceClient()
  let query = supabase.schema('mise').from('checklist_templates').select('*').eq('ativo', true)
  if (unit_id) query = query.eq('unit_id', unit_id)

  const { data, error } = await query.order('nome')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ templates: data ?? [] })
}

export async function POST(request: Request) {
  const body = await request.json()
  if (!body.nome?.trim()) {
    return NextResponse.json({ error: 'nome é obrigatório' }, { status: 400 })
  }
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .schema('mise')
    .from('checklist_templates')
    .insert(body)
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}
