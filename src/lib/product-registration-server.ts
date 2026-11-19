import { NextResponse } from 'next/server'
import { requireMiseRole } from '@/lib/session'
import { createServiceClient } from '@/lib/supabase/server'
import { isUuid } from '@/lib/business-registration'
import { validateProduct } from '@/lib/product-registration'

export async function saveProduct(request: Request, id?: string) {
  const actor = await requireMiseRole(['admin', 'gerente'])
  if (!actor) return NextResponse.json({ error: 'Sem permissão para cadastrar produtos.' }, { status: 403 })
  if (id && !isUuid(id)) return NextResponse.json({ error: 'Produto inválido.' }, { status: 400 })
  let data: ReturnType<typeof validateProduct>
  try { data = validateProduct(await request.json()) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Confira os dados do produto.' }, { status: 400 }) }
  const table = createServiceClient().from('ingredients')
  if (actor.role !== 'admin') {
    const fields = ['sif', 'marca', 'categoria_anvisa', 'metodo_conservacao', 'prazo_validade_horas'] as const
    const previous = id ? await table.select(fields.join(',')).eq('id', id).maybeSingle() : null
    if (previous?.error) return NextResponse.json({ error: 'Não foi possível consultar o produto.' }, { status: 400 })
    if (id && !previous?.data) return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 })
    const savedSettings = previous?.data as Record<string, unknown> | null | undefined
    if (fields.some(key => (data[key] ?? null) !== (savedSettings?.[key] ?? null))) return NextResponse.json({ error: 'Somente administradores podem definir conservação, validade, categoria sanitária, SIF e marca.' }, { status: 403 })
    // Não regravar configurações protegidas evita sobrescrever uma edição concorrente do admin.
    for (const key of fields) delete (data as Partial<typeof data>)[key]
  }
  const result = id ? await table.update(data).eq('id', id).select('id').maybeSingle() : await table.insert(data).select('id').single()
  if (result.error) return NextResponse.json({ error: result.error.code === '23505' ? 'Já existe um produto com esses dados.' : 'Não foi possível salvar o produto. Confira o grupo, o fornecedor e os campos obrigatórios.' }, { status: 400 })
  if (!result.data) return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 })
  return NextResponse.json({ id: result.data.id }, { status: id ? 200 : 201 })
}
