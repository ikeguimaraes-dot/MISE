import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { resolveShelfLifeRule } from '@/lib/shelf-life-server'
import { calculateExpiry } from '@/lib/shelf-life'

export async function POST(request: Request) {
  const { categoria_anvisa, prazo_fabricante_horas, ...body } = await request.json()
  try {
    const rule = await resolveShelfLifeRule({ method: body.metodo_conservacao, category: categoria_anvisa, ingredientId: body.ingredient_id, manufacturerHours: prazo_fabricante_horas })
    body.validade = calculateExpiry(body.data_manipulacao, rule.prazo_horas, body.validade_fornecedor)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível calcular a validade.' }, { status: 422 })
  }
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .schema('mise')
    .from('labels')
    .insert(body)
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ id: data.id, validade: body.validade })
}
