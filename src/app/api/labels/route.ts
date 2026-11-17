import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { resolveShelfLifeRule } from '@/lib/shelf-life-server'
import { getMiseSession } from '@/lib/session'
import { requestedLabelExpiry, saoPauloIso } from '@/lib/label-expiry'

export async function POST(request: Request) {
  const actor = await getMiseSession()
  if (!actor) return NextResponse.json({ error: 'Sua sessão expirou. Entre novamente.' }, { status: 401 })
  let input
  try { input = await request.json() } catch { return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 }) }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  const body: Record<string, unknown> = {}
  for (const key of ['unit_id', 'responsavel_id', 'responsavel_nome', 'ingredient_id', 'menu_item_id', 'tipo', 'nome', 'peso_kg', 'setor', 'lote', 'selo', 'validade_fornecedor', 'metodo_conservacao', 'print_point_id']) if (input[key] !== undefined) body[key] = input[key]
  const supabase = createServiceClient()
  try {
    if (actor.role !== 'admin' && input.validade_manual) return NextResponse.json({ error: 'Somente administradores podem alterar a data de validade.' }, { status: 403 })
    const rule = await resolveShelfLifeRule({ method: input.metodo_conservacao, category: input.categoria_anvisa, ingredientId: input.ingredient_id, manufacturerHours: input.prazo_fabricante_horas })
    body.data_manipulacao = saoPauloIso(input.data_manipulacao)
    body.validade = requestedLabelExpiry({ manipulation: input.data_manipulacao, baseHours: rule.prazo_horas, hours: input.prazo_horas, manualExpiry: input.validade_manual, admin: actor.role === 'admin', supplierExpiry: input.validade_fornecedor })
    body.status = new Date(body.validade as string).getTime() <= Date.now() ? 'vencida' : 'ativa'
    if (actor.role === 'admin' && (input.validade_manual || input.prazo_horas != null)) {
      body.validade_original = requestedLabelExpiry({ manipulation: input.data_manipulacao, baseHours: rule.prazo_horas, admin: false, supplierExpiry: input.validade_fornecedor })
      body.validade_alterada_por = actor.employeeId
      body.validade_alterada_em = new Date().toISOString()
    }
    if (input.ingredient_id) {
      const product = await supabase.from('ingredients').select('sif').eq('id', input.ingredient_id).eq('ativo', true).maybeSingle()
      if (product.error || !product.data) throw new Error('Não foi possível consultar o SIF do produto.')
      body.sif = product.data.sif || null
      if (body.sif) body.selo = 'SIF'
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível calcular a validade.' }, { status: 422 })
  }
  const { data, error } = await supabase.schema('mise').from('labels').insert(body).select('id').single()
  if (error) return NextResponse.json({ error: 'Não foi possível salvar a etiqueta.' }, { status: 400 })
  return NextResponse.json({ id: data.id, validade: body.validade, sif: body.sif ?? null, selo: body.selo ?? null })
}
