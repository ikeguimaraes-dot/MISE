import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { resolveShelfLifeRule, type ProductShelfLifeSettings } from '@/lib/shelf-life-server'
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
    if (actor.role !== 'admin') {
      if (!input.ingredient_id || input.menu_item_id) return NextResponse.json({ error: 'Selecione um produto com conservação padronizada pela administração.' }, { status: 422 })
      if (input.prazo_horas != null || input.prazo_fabricante_horas != null) return NextResponse.json({ error: 'Somente administradores podem alterar o prazo de validade.' }, { status: 403 })
    }
    let productSettings: ProductShelfLifeSettings | undefined
    if (input.ingredient_id) {
      const product = await supabase.from('ingredients').select('nome, sif, marca, lote, categoria_anvisa, metodo_conservacao, prazo_validade_horas').eq('id', input.ingredient_id).eq('ativo', true).maybeSingle()
      if (product.error || !product.data) throw new Error('Não foi possível consultar o produto.')
      if (actor.role !== 'admin' && !product.data.metodo_conservacao) throw new Error('Peça a um administrador para padronizar a conservação e a validade no cadastro do produto.')
      productSettings = product.data
      input.metodo_conservacao = product.data.metodo_conservacao || input.metodo_conservacao
      input.categoria_anvisa = product.data.categoria_anvisa || (actor.role === 'admin' ? input.categoria_anvisa : null)
      input.prazo_fabricante_horas = product.data.prazo_validade_horas ?? (actor.role === 'admin' ? input.prazo_fabricante_horas : null)
      body.nome = product.data.nome
      body.metodo_conservacao = input.metodo_conservacao
      body.lote = input.lote ?? product.data.lote ?? null
      body.marca = product.data.marca || null
      body.sif = product.data.sif || null
      body.selo = body.sif ? 'SIF' : actor.role === 'admin' ? body.selo : null
    }
    // A hora do servidor prevalece sobre qualquer data enviada pelo funcionário.
    const manipulation = actor.role === 'admin' && input.data_manipulacao ? saoPauloIso(input.data_manipulacao) : new Date().toISOString()
    const rule = await resolveShelfLifeRule({ method: input.metodo_conservacao, category: input.categoria_anvisa, ingredientId: input.ingredient_id, manufacturerHours: input.prazo_fabricante_horas, productSettings })
    body.data_manipulacao = manipulation
    body.validade = requestedLabelExpiry({ manipulation, baseHours: rule.prazo_horas, hours: input.prazo_horas, manualExpiry: input.validade_manual, admin: actor.role === 'admin', supplierExpiry: input.validade_fornecedor })
    body.status = new Date(body.validade as string).getTime() <= Date.now() ? 'vencida' : 'ativa'
    if (actor.role === 'admin' && (input.validade_manual || input.prazo_horas != null)) {
      body.validade_original = requestedLabelExpiry({ manipulation, baseHours: rule.prazo_horas, admin: false, supplierExpiry: input.validade_fornecedor })
      body.validade_alterada_por = actor.employeeId
      body.validade_alterada_em = new Date().toISOString()
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível calcular a validade.' }, { status: 422 })
  }
  const { data, error } = await supabase.schema('mise').from('labels').insert(body).select('id').single()
  if (error) return NextResponse.json({ error: 'Não foi possível salvar a etiqueta.' }, { status: 400 })
  return NextResponse.json({ id: data.id, data_manipulacao: body.data_manipulacao, metodo_conservacao: body.metodo_conservacao, nome: body.nome, marca: body.marca ?? null, lote: body.lote ?? null, validade: body.validade, sif: body.sif ?? null, selo: body.selo ?? null })
}
