import { createServiceClient } from '@/lib/supabase/server'
import { getMiseSession } from '@/lib/session'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const session = await getMiseSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 })

  const body = await request.json()
  const { unit_id, agendado_para } = body

  if (!unit_id) return NextResponse.json({ error: 'unit_id obrigatório.' }, { status: 400 })
  if (!agendado_para || !/^\d{4}-\d{2}-\d{2}(T\S+)?$/.test(String(agendado_para))) {
    return NextResponse.json({ error: 'agendado_para obrigatório (ISO date).' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: templates } = await supabase
    .schema('mise')
    .from('checklist_templates')
    .select('id, categoria')
    .eq('modulo', 'CRIVO')
    .eq('ativo', true)
    .or(`unit_id.eq.${unit_id},unit_id.is.null`)
    .order('created_at', { ascending: false })

  if (!templates || templates.length === 0) {
    return NextResponse.json(
      { error: 'Nenhum template CRIVO cadastrado. Crie os templates antes de agendar uma visita.' },
      { status: 422 }
    )
  }

  // One template per categoria (most recent)
  const seen = new Set<string>()
  const toCreate: { id: string; categoria: string | null }[] = []
  for (const t of templates) {
    const cat = t.categoria ?? 'sem_categoria'
    if (!seen.has(cat)) {
      seen.add(cat)
      toCreate.push(t)
    }
  }

  const rows = toCreate.map(t => ({
    template_id: t.id,
    unit_id,
    status: 'agendado',
    agendado_para,
    agendado_por: session.employeeId,
  }))

  const { data: created, error } = await supabase
    .schema('mise')
    .from('checklist_executions')
    .insert(rows)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ids: (created ?? []).map(r => r.id) }, { status: 201 })
}
