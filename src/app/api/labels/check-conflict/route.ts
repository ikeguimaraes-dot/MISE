import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const ingredient_id = searchParams.get('ingredient_id')
  const unit_id = searchParams.get('unit_id')

  if (!ingredient_id || !unit_id) {
    return NextResponse.json({ conflict: null })
  }

  const supabase = createServiceClient()

  const { data } = await supabase
    .schema('mise')
    .from('labels')
    .select('id, nome, employee_id, data_manipulacao, validade')
    .eq('ingredient_id', ingredient_id)
    .eq('unit_id', unit_id)
    .eq('status', 'ativa')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!data) return NextResponse.json({ conflict: null })

  let employee_name = null
  if (data.employee_id) {
    const { data: emp } = await supabase
      .from('employees')
      .select('nome')
      .eq('id', data.employee_id)
      .single()
    employee_name = emp?.nome ?? null
  }

  return NextResponse.json({
    conflict: {
      id: data.id,
      nome: data.nome,
      data_manipulacao: data.data_manipulacao,
      validade: data.validade,
      employee_name: employee_name ?? '—',
    },
  })
}
